import {test,expect,beforeEach,afterEach} from 'bun:test';
import {createOffice,jwt} from '../server';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
const origin='https://office.example',warehouse='https://warehouse.example',secret='s'.repeat(48),editorSecret='e'.repeat(48);
const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');const uid=(id:string)=>'ast_'+digest(id).slice(0,40);
const assets:any={};for(const ext of ['docx','xlsx','pptx'])assets['/templates/blank.'+ext]={data:readFileSync(new URL('../templates/blank.'+ext,import.meta.url)).toString('base64')};
let app:any,dir:string,revision=0,driveBytes:Record<string,number>,files:Map<string,{bytes:Uint8Array,etag:string,id:string}>,dirs:Set<string>;
const xml=(s:any)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const quota=(id:string)=>id==='b'?8_000_000_000:2_000_000_000;
const usage=(id:string)=>(driveBytes[id]||0)+[...files].filter(([p])=>p.startsWith(uid(id)+'/')).reduce((n,[_,f])=>n+f.bytes.length,0);
async function network(input:any,options:any={}){
 const url=new URL(input),method=options.method||'GET';
 if(url.pathname==='/api/internal/office-entitlement'){const actor=url.searchParams.get('actor')!;return Response.json({actor,plus:actor==='b',warehouseOrigin:warehouse,warehouseUid:uid(actor),warehouseToken:'private-'+actor});}
 if(url.pathname==='/cache/edited')return new Response('a saved document');
 if(url.origin!==warehouse)throw Error('Unexpected request '+url);
 const id=options.headers.Authorization?.slice('Bearer private-'.length);expect(['a','b']).toContain(id);
 const root='/remote.php/dav/files/'+uid(id)+'/',path=decodeURIComponent(url.pathname.slice(root.length)).replace(/\/$/,'');expect(url.pathname.startsWith(root)).toBe(true);
 const key=uid(id)+'/'+path,headers=options.headers||{};
 if(method==='MKCOL'){if(dirs.has(key))return new Response('',{status:405});dirs.add(key);return new Response('',{status:201});}
 if(method==='PROPFIND'){
  if(path&&!files.has(key)&&!dirs.has(key))return new Response('',{status:404});
  const rows=[key];if(headers.Depth==='1')for(const k of [...dirs,...files.keys()])if(k.startsWith(key+(path?'/':''))&&k!==key&&k.slice(key.length+(path?1:0)).split('/').length===1)rows.push(k);
  const body=rows.map(k=>{const f=files.get(k),p=k.slice(uid(id).length+1);return '<d:response><d:href>'+xml(root+p)+'</d:href><d:propstat><d:prop><d:displayname>'+xml(p.split('/').pop())+'</d:displayname><d:getcontentlength>'+(f?.bytes.length||0)+'</d:getcontentlength><d:getetag>'+xml(f?.etag||'"folder"')+'</d:getetag><oc:fileid>'+(f?.id||'folder')+'</oc:fileid><d:resourcetype>'+(f?'':'<d:collection/>')+'</d:resourcetype><d:quota-used-bytes>'+usage(id)+'</d:quota-used-bytes><d:quota-available-bytes>'+Math.max(0,quota(id)-usage(id))+'</d:quota-available-bytes></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>';}).join('');return new Response('<d:multistatus xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">'+body+'</d:multistatus>',{status:207});
 }
 if(method==='GET')return files.has(key)?new Response(files.get(key)!.bytes):new Response('',{status:404});
 if(method==='PUT'){
  const old=files.get(key);if(headers['If-None-Match']==='*'&&old||headers['If-Match']&&headers['If-Match']!==old?.etag)return new Response('',{status:412});
  const bytes=new Uint8Array(options.body);if(usage(id)-(old?.bytes.length||0)+bytes.length>quota(id))return new Response('',{status:507});
  files.set(key,{bytes,etag:'"'+(++revision)+'"',id:old?.id||String(revision)});return new Response('',{status:old?204:201});
 }
 if(method==='DELETE'){for(const k of files.keys())if(k===key||k.startsWith(key+'/'))files.delete(k);dirs.delete(key);return new Response(null,{status:204});}
 if(method==='MOVE'){
  const old=files.get(key);if(!old)return new Response('',{status:404});if(old.etag!==headers['If-Match'])return new Response('',{status:412});const dest=uid(id)+'/'+decodeURIComponent(new URL(headers.Destination).pathname.slice(root.length));files.set(dest,old);files.delete(key);return new Response('',{status:201});
 }
 throw Error('Unexpected WebDAV '+method);
}
beforeEach(()=>{files=new Map();dirs=new Set();driveBytes={};dir=mkdtempSync(join(tmpdir(),'shared-office-'));app=createOffice({env:{DATA_DIR:dir,PUBLIC_ORIGIN:origin,SOCIAL_ORIGIN:'https://platform.example',WAREHOUSE_ORIGIN:warehouse,OFFICE_SECRET:secret,JWT_SECRET:editorSecret,OFFICE_ENTITLEMENT_SECRET:secret,DOCS_URL:'https://editor.example'},assets,fetch:network});for(const id of ['a','b']){dirs.add(uid(id)+'/');app.db.query('INSERT INTO users VALUES(?,?,?,?)').run(id,id,id,Date.now());app.db.query('INSERT INTO sessions VALUES(?,?,?)').run(digest(id),id,Date.now()+999999);}});
afterEach(()=>{app.close();rmSync(dir,{recursive:true,force:true});});
async function call(path:string,method='GET',body:any=undefined,id='a'){return app.fetch(new Request(origin+path,{method,headers:{origin,cookie:'ao_session='+id},body:body===undefined?undefined:JSON.stringify(body)}));}
async function make(id='a'){const r=await call('/api/documents','POST',{ext:'docx',title:'Draft'},id);expect(r.status).toBe(201);return(await r.json()).document;}
async function config(d:any){return(await call('/api/documents/'+d.id+'/config')).json();}
async function save(d:any,c:any){const u=new URL(c.config.editorConfig.callbackUrl),p={key:c.config.document.key,status:2,url:'https://editor.example/cache/edited'};return call(u.pathname+u.search,'POST',{...p,token:jwt(p,editorSecret)});}

test('Drive consumes the same free allowance that Office uses',async()=>{driveBytes.a=2_000_000_000;expect((await call('/api/documents','POST',{ext:'docx'})).status).toBe(413);const r=await(await call('/api/documents')).json();expect(r.usedBytes).toBe(2_000_000_000);expect(r.quotaBytes).toBe(2_000_000_000);expect(r.sharedStorage).toBe(true);expect(app.db.query('SELECT COUNT(*) n FROM documents').get().n).toBe(0);});
test('Plus has one 8 GB account allowance across Drive and Office',async()=>{driveBytes.b=1_999_999_999;const d=await make('b');const r=await(await call('/api/documents','GET',undefined,'b')).json();expect(r.usedBytes).toBe(driveBytes.b+d.size);expect(r.quotaBytes).toBe(8_000_000_000);driveBytes.b=8_000_000_000;expect((await call('/api/documents','POST',{ext:'docx'},'b')).status).toBe(413);});
test('Office saves are visible in Warehouse and snapshots count once each',async()=>{const d=await make(),c=await config(d);expect(d.warehousePath).toMatch(/^AltOffice\//);expect((await save(d,c)).status).toBe(200);expect(await(await call('/api/documents/'+d.id+'/download')).text()).toBe('a saved document');expect((await(await call('/api/documents')).json()).usedBytes).toBe(d.size+Buffer.byteLength('a saved document'));const versions=await(await call('/api/documents/'+d.id+'/versions')).json();expect(versions.versions).toHaveLength(2);expect(Buffer.from(await(await call('/api/documents/'+d.id+'/download?revision=1')).arrayBuffer()).subarray(0,2).toString()).toBe('PK');});
test('an external Warehouse edit cannot be overwritten by an old editor callback',async()=>{const d=await make(),c=await config(d),key=uid('a')+'/'+d.warehousePath,old=files.get(key)!;files.set(key,{...old,bytes:Buffer.from('changed in Warehouse'),etag:'"external"'});expect((await save(d,c)).status).toBe(409);expect(Buffer.from(files.get(key)!.bytes).toString()).toBe('changed in Warehouse');expect(await(await call('/api/documents/'+d.id+'/download')).text()).toBe('changed in Warehouse');expect((await config(d)).config.document.key).not.toBe(c.config.document.key);});
test('renaming and deletion change the canonical Warehouse file and release shared usage',async()=>{const d=await make();expect((await call('/api/documents/'+d.id,'PATCH',{title:'Renamed'})).status).toBe(200);expect([...files.keys()].some(k=>k.endsWith('/Renamed.docx'))).toBe(true);expect((await call('/api/documents/'+d.id,'DELETE')).status).toBe(200);expect((await(await call('/api/documents')).json()).usedBytes).toBe(0);});
test('a revoked or unavailable Warehouse connection cannot fall back to separate Office storage',async()=>{const d=await make();app.db.query('UPDATE documents SET warehouse_path=? WHERE id=?').run('missing/file.docx',d.id);expect((await call('/api/documents/'+d.id+'/download')).status).toBe(404);});

test('opening an existing Warehouse file reuses the same bytes and document identity',async()=>{
 const path='Notes.docx',bytes=Buffer.from('existing Warehouse document');files.set(uid('a')+'/'+path,{bytes,etag:'"existing"',id:'existing-id'});
 const before=usage('a');const opened=await call('/api/warehouse/open','POST',{path});expect(opened.status).toBe(201);const d=(await opened.json()).document;
 expect(usage('a')).toBe(before);expect(await(await call('/api/documents/'+d.id+'/download')).text()).toBe(bytes.toString());
 const again=await call('/api/warehouse/open','POST',{path});expect(again.status).toBe(200);expect((await again.json()).document.id).toBe(d.id);expect(app.db.query('SELECT COUNT(*) n FROM documents').get().n).toBe(1);
});
test('legacy Office files and every saved version migrate once with verified content',async()=>{
 const id='0123456789abcdef0123456789abcdef',old=Buffer.from('original Office file'),latest=Buffer.from('second saved version'),now=Date.now();
 for(const bytes of [old,latest])await Bun.write(join(dir,'files',digest(bytes)),bytes);
 app.db.query('INSERT INTO documents(id,owner,title,ext,digest,size,revision,created,updated) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'a','Legacy','docx',digest(latest),latest.length,2,now,now);
 for(const [i,bytes]of [old,latest].entries())app.db.query('INSERT INTO versions(doc,revision,digest,size,created) VALUES(?,?,?,?,?)').run(id,i+1,digest(bytes),bytes.length,now);
 let response=await(await call('/api/documents')).json();expect(response.usedBytes).toBe(old.length+latest.length);expect(response.documents[0].warehousePath).toMatch(/^AltOffice\//);
 response=await(await call('/api/documents')).json();expect(response.usedBytes).toBe(old.length+latest.length);expect(files.size).toBe(2);
 expect(await(await call('/api/documents/'+id+'/download?revision=1')).text()).toBe(old.toString());expect(await(await call('/api/documents/'+id+'/download')).text()).toBe(latest.toString());
 expect(Buffer.from(await Bun.file(join(dir,'files',digest(old))).arrayBuffer()).equals(old)).toBe(true);
});
test('Warehouse paths cannot escape the authenticated account',async()=>{
 for(const path of ['../other-account/private.docx','AltOffice/../../secret.docx','folder\\secret.docx'])expect((await call('/api/warehouse/open','POST',{path})).status).toBe(400);
});
