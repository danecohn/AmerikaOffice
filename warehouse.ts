import {XMLParser} from 'fast-xml-parser';

export type WarehouseCredentials={warehouseOrigin:string,warehouseUid:string,warehouseToken:string};
const parser=new XMLParser({removeNSPrefix:true,ignoreAttributes:false,processEntities:true});
const list=(v:any)=>v===undefined?[]:Array.isArray(v)?v:[v];
const error=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
// The destination is fixed by server configuration, never by a browser request.
export function createWarehouse({origin,credentials,fetch:net=fetch,maxFile=25*1024*1024}: {origin:string,credentials:(id:string)=>Promise<WarehouseCredentials>,fetch?:typeof fetch,maxFile?:number}){
 const base=new URL(origin);if(!['https:','http:'].includes(base.protocol)||base.username||base.password||base.pathname!=='/')throw Error('Invalid Warehouse origin');
 const clean=(path:string)=>{if(typeof path!=='string'||path.length>2048||path.includes('\\')||/[\x00-\x1f]/.test(path)||path.split('/').some(p=>p==='.'||p==='..'))error(400,'Invalid Warehouse path.');return path.split('/').filter(Boolean).join('/');};
 const encoded=(path:string)=>clean(path).split('/').map(encodeURIComponent).join('/');
 const root=(uid:string)=>'/remote.php/dav/files/'+encodeURIComponent(uid)+'/';
 async function request(id:string,path:string,method:string,headers:Record<string,string>={},body?:Uint8Array|string){
  const c=await credentials(id);if(new URL(c.warehouseOrigin).origin!==base.origin||!/^ast_[a-f0-9]{40}$/.test(c.warehouseUid)||!c.warehouseToken)error(503,'Warehouse credentials are unavailable.');
  const response=await net(new URL(root(c.warehouseUid)+encoded(path),base),{method,headers:{Authorization:'Bearer '+c.warehouseToken,'OCS-APIRequest':'true',...headers},body,redirect:'error',signal:AbortSignal.timeout(60000)});
  if(response.status===401||response.status===403)error(503,'Your Cohnsoft storage connection needs to be refreshed.');
  if(response.status===507||response.status===413)error(413,'Your shared Cohnsoft storage allowance is full. Remove files in Warehouse or upgrade to Plus.');
  if(response.status===412)error(409,'This file changed in Warehouse. Reopen it before saving your changes.');
  if(response.status===404)error(404,'This file or folder was moved or deleted in Warehouse.');
  if(!response.ok&&response.status!==207)error(502,'Warehouse could not complete this request.');
  return {response,uid:c.warehouseUid};
 }
 async function readResponse(response:Response,limit=maxFile){
  if(Number(response.headers.get('content-length'))>limit)error(413,'File is too large to open in Office.');let size=0;const chunks=[];
  for await(const chunk of response.body as any){size+=chunk.length;if(size>limit)error(413,'File is too large to open in Office.');chunks.push(chunk);}return Buffer.concat(chunks);
 }
 async function entries(id:string,path:string,depth='0'){
  const {response,uid}=await request(id,path,'PROPFIND',{Depth:depth,'Content-Type':'application/xml'},'<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><d:displayname/><d:getcontentlength/><d:getetag/><d:resourcetype/><d:quota-used-bytes/><d:quota-available-bytes/><oc:fileid/><oc:permissions/></d:prop></d:propfind>');
  const text=(await readResponse(response,4*1024*1024)).toString();if(/<!DOCTYPE|<!ENTITY/i.test(text))error(502,'Invalid Warehouse response.');
  return list(parser.parse(text)?.multistatus?.response).map((r:any)=>{
   const p=Object.assign({},...list(r.propstat).filter((v:any)=>/ 200 /.test(v.status)).map((v:any)=>v.prop));let href;
   try{href=decodeURIComponent(new URL(r.href,base).pathname);}catch{error(502,'Invalid Warehouse response.');}
   const prefix=decodeURIComponent(root(uid));if(!href.startsWith(prefix))error(502,'Invalid Warehouse file path.');
   return {path:clean(href.slice(prefix.length)),name:String(p.displayname||href.split('/').filter(Boolean).pop()||''),size:Number(p.getcontentlength||0),etag:String(p.getetag||''),id:String(p.fileid||''),directory:p.resourcetype&&Object.hasOwn(p.resourcetype,'collection'),usedBytes:Number(p['quota-used-bytes']||0),availableBytes:Number(p['quota-available-bytes']||0),permissions:String(p.permissions||'')};
  });
 }
 async function stat(id:string,path:string){const rows=await entries(id,path);return rows.find((v:any)=>v.path===clean(path))||error(404,'File not found in Warehouse.');}
 async function mkdir(id:string,path:string){let current='';for(const part of clean(path).split('/').filter(Boolean)){current+=(current?'/':'')+part;try{await request(id,current,'MKCOL');}catch(e:any){if(e.status!==502)throw e;const s=await stat(id,current);if(!s.directory)throw e;}}}
 return {
  clean,stat,mkdir,
  async list(id:string,path=''){const rows=await entries(id,path,'1');return rows.filter((v:any)=>v.path!==clean(path));},
  async usage(id:string){const s=await stat(id,'');return {usedBytes:s.usedBytes,availableBytes:Math.max(0,s.availableBytes)};},
  async read(id:string,path:string){return readResponse((await request(id,path,'GET')).response);},
  async put(id:string,path:string,bytes:Uint8Array,etag?:string){if(bytes.length>maxFile)error(413,'File is too large.');await request(id,path,'PUT',{'Content-Type':'application/octet-stream',...(etag?{'If-Match':etag}:{'If-None-Match':'*'})},bytes);return stat(id,path);},
  async copy(id:string,path:string,destination:string,etag:string){const c=await credentials(id);await request(id,path,'COPY',{Destination:new URL(root(c.warehouseUid)+encoded(destination),base).href,Overwrite:'F','If-Match':etag});return stat(id,destination);},
  async move(id:string,path:string,destination:string,etag:string){const c=await credentials(id);await request(id,path,'MOVE',{Destination:new URL(root(c.warehouseUid)+encoded(destination),base).href,Overwrite:'F','If-Match':etag});return stat(id,destination);},
  async remove(id:string,path:string){try{await request(id,path,'DELETE');}catch(e:any){if(e.status!==404)throw e;}},
 };
}

