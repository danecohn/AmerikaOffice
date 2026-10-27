import {createWarehouse} from './warehouse';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
// Warehouse owns cloud bytes. SQLite retains Office permissions and editor sessions.
export function createCloudFiles({db,dir,origin,credentials,fetch:net,maxFile}:any){
 for(const [table,name] of [['documents','warehouse_path'],['documents','warehouse_etag'],['documents','warehouse_id'],['versions','warehouse_path']]){
  if(!db.query('PRAGMA table_info('+table+')').all().some((c:any)=>c.name===name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' TEXT');
 }
 const dav=createWarehouse({origin,credentials,fetch:net,maxFile}),q=(sql:string)=>db.query(sql);
 const locks=new Map<string,Promise<any>>();
 async function serial<T>(id:string,fn:()=>Promise<T>):Promise<T>{const task=(locks.get(id)||Promise.resolve()).catch(()=>{}).then(fn);locks.set(id,task);try{return await task;}finally{if(locks.get(id)===task)locks.delete(id);}}
 const doc=(id:string)=>q('SELECT * FROM documents WHERE id=? AND deleted=0').get(id)||fail(404,'Document not found.');
 const archive=(d:any,rev:number)=>'AltOffice/.history/'+d.id+'/'+rev+'.'+d.ext;
 const current=(d:any)=>'AltOffice/'+d.id+'/'+d.title+'.'+d.ext;
 const local=(digest:string)=>Bun.file(join(dir,'files',digest));
 async function verified(id:string,path:string,bytes:Uint8Array,digest:string){
  let state;try{state=await dav.stat(id,path);}catch(e:any){if(e.status!==404)throw e;}
  if(state){if(hash(await dav.read(id,path))!==digest)fail(409,'A Vigil Drive migration file differs from the original. Your local original is safe.');return state;}
  state=await dav.put(id,path,bytes);if(hash(await dav.read(id,path))!==digest)fail(502,'Vigil Drive file verification failed. Your original is safe.');return state;
 }
 async function migrateUnlocked(id:string){
  const rows=q('SELECT * FROM documents WHERE owner=? AND deleted=0 AND warehouse_path IS NULL ORDER BY created').all(id);
  for(const d of rows){
   await dav.mkdir(id,'AltOffice/.history/'+d.id);await dav.mkdir(id,'AltOffice/'+d.id);
   for(const v of q('SELECT * FROM versions WHERE doc=? ORDER BY revision').all(d.id)){
    const path=v.revision===d.revision?current(d):archive(d,v.revision),bytes=new Uint8Array(await local(v.digest).arrayBuffer());
    if(hash(bytes)!==v.digest)fail(502,'Local document verification failed. Migration stopped.');
    const state=await verified(id,path,bytes,v.digest);
    db.transaction(()=>{q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(path,d.id,v.revision);if(v.revision===d.revision)q('UPDATE documents SET warehouse_path=?,warehouse_etag=?,warehouse_id=? WHERE id=?').run(path,state.etag,state.id,d.id);})();
   }
  }
 }
 async function readVersion(d:any,revision:number){const v=q('SELECT * FROM versions WHERE doc=? AND revision=?').get(d.id,revision);if(!v)fail(404,'Version not found.');if(!v.warehouse_path)fail(503,'This document is still moving to Vigil Drive.');return dav.read(d.owner,v.warehouse_path);}
 async function oldSnapshot(d:any){
  const path=archive(d,d.revision);await dav.mkdir(d.owner,'AltOffice/.history/'+d.id);
  const bytes=new Uint8Array(await local(d.digest).arrayBuffer());if(hash(bytes)!==d.digest)fail(502,'The last saved document snapshot could not be verified.');
  await verified(d.owner,path,bytes,d.digest);return path;
 }
 async function syncUnlocked(d:any){
  const state=await dav.stat(d.owner,d.warehouse_path);if(state.etag===d.warehouse_etag)return d;
  const bytes=await dav.read(d.owner,d.warehouse_path),digest=hash(bytes);
  if(digest===d.digest){q('UPDATE documents SET warehouse_etag=? WHERE id=?').run(state.etag,d.id);return doc(d.id);}
  const prior=await oldSnapshot(d);await Bun.write(join(dir,'files',digest),bytes);const now=Date.now();
  db.transaction(()=>{q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(prior,d.id,d.revision);q('INSERT INTO versions(doc,revision,digest,size,created,warehouse_path) VALUES(?,?,?,?,?,?)').run(d.id,d.revision+1,digest,bytes.length,now,d.warehouse_path);q('UPDATE documents SET digest=?,size=?,revision=revision+1,epoch=epoch+1,updated=?,warehouse_etag=? WHERE id=?').run(digest,bytes.length,now,state.etag,d.id);})();return doc(d.id);
 }
 return {
  migrate:(id:string)=>serial(id,()=>migrateUnlocked(id)),
  async usage(id:string){await serial(id,()=>migrateUnlocked(id));return dav.usage(id);},
  async import(id:string,path:string){await serial(id,()=>migrateUnlocked(id));const state=await dav.stat(id,path);if(state.directory)fail(400,'Choose a document.');if(state.permissions&&!state.permissions.includes('W'))fail(403,'Only files you can edit in Vigil Drive can be opened in Office.');const bytes=await dav.read(id,path);await Bun.write(join(dir,'files',hash(bytes)),bytes);return {state,bytes,digest:hash(bytes)};},
  async list(id:string,path=''){await serial(id,()=>migrateUnlocked(id));return dav.list(id,path);},
  async create(id:string,d:any,bytes:Uint8Array){return serial(id,async()=>{await migrateUnlocked(id);await dav.mkdir(id,'AltOffice/'+d.id);return verified(id,current(d),bytes,hash(bytes));});},
  attach(id:string,state:any){db.transaction(()=>{q('UPDATE documents SET warehouse_path=?,warehouse_etag=?,warehouse_id=? WHERE id=?').run(state.path,state.etag,state.id,id);q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=1').run(state.path,id);})();},
  async open(d:any){return serial(d.owner,async()=>{await migrateUnlocked(d.owner);return {...await syncUnlocked(doc(d.id)),role:d.role};});},
  async read(d:any,revision=d.revision){await serial(d.owner,()=>migrateUnlocked(d.owner));return readVersion(doc(d.id),revision);},
  async rename(d:any,title:string){return serial(d.owner,async()=>{await migrateUnlocked(d.owner);const latest=doc(d.id),state=await dav.move(d.owner,latest.warehouse_path,current({...latest,title}),latest.warehouse_etag);db.transaction(()=>{q('UPDATE documents SET warehouse_path=?,warehouse_etag=? WHERE id=?').run(state.path,state.etag,d.id);q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(state.path,d.id,latest.revision);})();});},
  async remove(d:any){return serial(d.owner,async()=>{await migrateUnlocked(d.owner);const latest=doc(d.id);await dav.remove(d.owner,latest.warehouse_path);await dav.remove(d.owner,'AltOffice/.history/'+d.id);});},
  async save(d:any,bytes:Uint8Array,commit:(current:any)=>void){return serial(d.owner,async()=>{
   await migrateUnlocked(d.owner);const latest=doc(d.id);if(latest.epoch!==d.epoch)fail(409,'This editing session is no longer current. Reopen the document.');
   const state=await dav.stat(d.owner,latest.warehouse_path);if(state.etag!==latest.warehouse_etag)fail(409,'This document changed in Vigil Drive. Reopen it before saving.');
   const prior=await oldSnapshot(latest),saved=await dav.put(d.owner,latest.warehouse_path,bytes,state.etag);
   // The remote revision is durable before committing the Office revision.
   db.transaction(()=>{commit(latest);q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(prior,d.id,latest.revision);q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(latest.warehouse_path,d.id,latest.revision+1);q('UPDATE documents SET warehouse_etag=? WHERE id=?').run(saved.etag,d.id);})();
  });},
 };
}
