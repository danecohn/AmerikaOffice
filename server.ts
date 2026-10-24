import {Database} from 'bun:sqlite';
import {createCloudFiles} from './cloud-files';
import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {mkdirSync,renameSync,existsSync,readFileSync,unlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
// The release bundler replaces this declaration with static assets and OOXML templates.
const ASSETS: Record<string,{type:string,data:string}> = {}; // BUNDLE_ASSETS
const token=()=>randomBytes(32).toString('base64url');
const hash=(s:string|Uint8Array)=>createHash('sha256').update(s).digest('hex');
const b64=(o:any)=>Buffer.from(JSON.stringify(o)).toString('base64url');
export function jwt(data:any,secret:string){const body=b64({alg:'HS256',typ:'JWT'})+'.'+b64(data);return body+'.'+createHmac('sha256',secret).update(body).digest('base64url');}
export function verifyJwt(value:string,secret:string){
 const parts=String(value||'').split('.');if(parts.length!==3)throw Error('Invalid signature');
 const signed=parts[0]+'.'+parts[1],expect=createHmac('sha256',secret).update(signed).digest();let got=Buffer.from(parts[2],'base64url');
 if(got.length!==expect.length||!timingSafeEqual(got,expect))throw Error('Invalid signature');
 const h=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(h.alg!=='HS256')throw Error('Invalid signature');
 const p=JSON.parse(Buffer.from(parts[1],'base64url').toString());if(p.exp&&p.exp<Date.now()/1000)throw Error('Expired signature');return p;
}
export function createOffice(options:any={}){
 const env=options.env||process.env,dir=env.DATA_DIR||'./data',origin=env.PUBLIC_ORIGIN||'http://localhost:3000',docs=env.DOCS_URL||'https://editor.altstack.org',social=env.SOCIAL_ORIGIN||'https://altstack.org';
 const secret=env.OFFICE_SECRET,editorSecret=env.JWT_SECRET;
 if(!secret||secret.length<32||!editorSecret||editorSecret.length<32)throw Error('Set independent OFFICE_SECRET and JWT_SECRET, at least 32 characters each.');
 mkdirSync(join(dir,'files'),{recursive:true});
 const db=new Database(join(dir,'office.sqlite'),{create:true});db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,handle TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS pairings(hash TEXT PRIMARY KEY,id TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY,owner TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,ext TEXT NOT NULL,digest TEXT NOT NULL,size INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 1,epoch INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,updated INTEGER NOT NULL,deleted INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS members(doc TEXT NOT NULL REFERENCES documents(id),user TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,PRIMARY KEY(doc,user));
 CREATE TABLE IF NOT EXISTS shares(hash TEXT PRIMARY KEY,doc TEXT NOT NULL REFERENCES documents(id),role TEXT NOT NULL,expires INTEGER NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS versions(doc TEXT NOT NULL REFERENCES documents(id),revision INTEGER NOT NULL,digest TEXT NOT NULL,size INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(doc,revision));
 CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,doc TEXT,user TEXT,action TEXT NOT NULL,created INTEGER NOT NULL);`);
 const maxFile=Number(env.MAX_FILE_BYTES||25*1024*1024),quota=2_000_000_000,plusQuota=8_000_000_000,globalQuota=Number(env.TOTAL_QUOTA_BYTES||128_000_000_000);
 const net=options.fetch||fetch,assets=options.assets||ASSETS;const inflight=new Set<string>(),rates=new Map<string,{n:number,until:number}>();
 const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
 const q=(s:string)=>db.query(s);const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
 const cookie=(req:Request,name:string)=>{const part=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return part?.slice(name.length+1)||'';};
 const cookieString=(name:string,value:string,age:number)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin.startsWith('https:')?'; Secure':''}`;
 const session=(req:Request)=>q('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user WHERE s.hash=? AND s.expires>?').get(hash(cookie(req,'ao_session')),Date.now()) as any;
 const user=(req:Request)=>session(req)||fail(401,'Sign in to AltOffice.');
 const doc=(id:string)=>q('SELECT * FROM documents WHERE id=? AND deleted=0').get(id) as any||fail(404,'Document not found.');
 const access=(id:string,u:any,write=false)=>{const d=doc(id);const role=d.owner===u.id?'owner':(q('SELECT role FROM members WHERE doc=? AND user=?').get(id,u.id) as any)?.role;if(!role||(write&&role==='view'))fail(403,'You do not have permission for this document.');return {...d,role};};
 const owner=(id:string,u:any)=>{const d=access(id,u);if(d.role!=='owner')fail(403,'Only the owner can change sharing or delete this document.');return d;};
 const browserOrigins=new Set([origin,...(env.BROWSER_ORIGIN_ALIASES||'').split(',').map((v:string)=>v.trim()).filter(Boolean)]);
 const csrf=(req:Request)=>{if(!browserOrigins.has(req.headers.get('origin')||''))fail(403,'Request origin rejected.');};
 const rate=(key:string,max=60)=>{const now=Date.now();for(const[k,v]of rates)if(v.until<now)rates.delete(k);const r=rates.get(key)||{n:0,until:now+3600000};r.n++;rates.set(key,r);if(r.n>max)fail(429,'Too many requests. Please try again later.');};
 const body=async(req:Request,limit=65536)=>{const raw=await req.text();if(Buffer.byteLength(raw)>limit)fail(413,'Request too large.');try{return JSON.parse(raw);}catch{fail(400,'Invalid JSON.');}};
 const event=(d:string|null,u:string|null,a:string)=>q('INSERT INTO events(doc,user,action,created) VALUES(?,?,?,?)').run(d,u,a,Date.now());
 const plans=new Map<string,any>();
 async function planFor(id:string){
  const cached=plans.get(id);if(cached&&cached.until>Date.now())return cached;
  const key=env.OFFICE_ENTITLEMENT_SECRET;if(!key||key.length<32)fail(503,'Storage plan verification is unavailable.');
  const path='/api/internal/office-entitlement?actor='+encodeURIComponent(id),time=String(Date.now());
  const signature=createHmac('sha256',key).update(time+'\nGET\n'+path).digest('base64url');
  const response=await net(social+path,{headers:{'x-altstack-time':time,'x-altstack-signature':signature},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)fail(503,'Storage plan verification is unavailable.');const result=await response.json() as any;
  if(result.actor!==id||typeof result.plus!=='boolean')fail(503,'Invalid storage plan response.');
  const plan={...result,plus:result.plus,until:Date.now()+240000};plans.set(id,plan);return plan;
 }
 const cloud=env.WAREHOUSE_ORIGIN?createCloudFiles({db,dir,origin:env.WAREHOUSE_ORIGIN,credentials:planFor,fetch:net,maxFile}):null;
 const quotaFor=(id:string)=>plans.get(id)?.plus?plusQuota:quota;
 function checkQuota(u:string,newBytes:number){
  if(cloud)return; // All cloud writes are checked against the same Warehouse account quota.
  const used=(q('SELECT COALESCE(SUM(v.size),0) AS n FROM versions v JOIN documents d ON d.id=v.doc WHERE d.owner=?').get(u) as any).n;
  const total=(q('SELECT COALESCE(SUM(size),0) AS n FROM versions').get() as any).n;
  if(used+newBytes>quotaFor(u))fail(413,'Your storage allowance is full.');if(total+newBytes>globalQuota)fail(507,'Office storage is full.');
 }
 async function store(bytes:Uint8Array){if(bytes.byteLength>maxFile)fail(413,'This file is too large.');const digest=hash(bytes);const target=join(dir,'files',digest);if(!existsSync(target)){const temp=target+'.'+token()+'.tmp';await Bun.write(temp,bytes);renameSync(temp,target);}return digest;}
 const cleanTitle=(s:any)=>String(s||'Untitled').normalize('NFC').replace(/[\x00-\x1f/\\]/g,' ').trim().slice(0,160)||'Untitled';
 const publicDoc=(d:any)=>({id:d.id,title:d.title,ext:d.ext,size:d.size,revision:d.revision,updated:d.updated,role:d.role||'owner',owner:d.owner,warehousePath:d.warehouse_path||null});
 const allowed=new Set(['docx','xlsx','pptx','pdf','odt','ods','odp','txt','csv','rtf','doc','xls','ppt']);
 const kind=(ext:string)=>['xlsx','xls','ods','csv'].includes(ext)?'cell':['pptx','ppt','odp'].includes(ext)?'slide':ext==='pdf'?'pdf':'word';
 const sign=(claims:any)=>jwt({...claims,exp:Math.floor(Date.now()/1000)+24*3600},secret);
 const verify=(value:string,scope:string,id:string)=>{let c:any;try{c=verifyJwt(value,secret);}catch{fail(403,'This document link has expired. Reopen it from Office.');}if(c.scope!==scope||c.id!==id)fail(403,'Invalid document link.');return c;};
 const socialCall=async(path:string,data:any)=>{const res=await net(social+'/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(15000)});const v=await res.json() as any;if(!res.ok)fail(res.status>=500?502:res.status,v.error||'AltStack account sign-in is unavailable.');return v;};
 async function handle(req:Request){
  const url=new URL(req.url),path=url.pathname,method=req.method;
  if(['GET','HEAD'].includes(method)&&url.hostname==='drive.altstack.org'&&!path.startsWith('/api/')&&!path.startsWith('/files/')&&!path.startsWith('/callbacks/'))return Response.redirect(origin+url.pathname+url.search,302);
  if(path==='/downloads')return Response.redirect(social+'/downloads/office',302);
  if(path==='/healthz')return json({ok:true,product:'AltOffice'});
  if(path==='/api/internal/warehouse-prepare'){
   if(method!=='GET')fail(405,'Use GET.');const key=env.WAREHOUSE_SERVICE_SECRET;if(!key||key.length<32||!cloud)fail(503,'Warehouse migration is not configured.');
   const time=req.headers.get('x-altstack-time'),signature=req.headers.get('x-altstack-signature');if(!time||!/^\d{13}$/.test(time)||Math.abs(Date.now()-Number(time))>60000||!signature||!/^[-_A-Za-z0-9]{43}$/.test(signature))fail(401,'Invalid service authorization.');
   const expected=createHmac('sha256',key).update(time+'\nGET\n'+url.pathname+url.search).digest('base64url');if(!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))fail(401,'Invalid service authorization.');
   const actor=url.searchParams.get('actor');if(!actor||actor.length>256)fail(400,'Choose an account.');await planFor(actor);await cloud.migrate(actor);return json({ready:true});
  }
  if(path==='/api/me'&&method==='GET'){const u=session(req);const plan=u?await planFor(u.id):null;return json({user:u||null,docsUrl:docs,maxFileBytes:maxFile,quotaBytes:u?quotaFor(u.id):quota,plan:plan?.plus?'plus':'free',warehouseOrigin:env.WAREHOUSE_ORIGIN||null,sharedStorage:!!cloud});}
  if(path==='/api/auth/start'&&method==='POST'){
   csrf(req);rate('signin:'+ (req.headers.get('x-railway-client-ip')||'unknown'),15);
   const verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');const result=await socialCall('desktop/start',{challenge});
   const state=token();q('DELETE FROM pairings WHERE expires<?').run(Date.now());q('INSERT INTO pairings VALUES(?,?,?,?)').run(hash(state),result.id,verifier,Date.now()+300000);
   return new Response(JSON.stringify({url:social+'/desktop-connect#'+encodeURIComponent(result.id)}),{headers:{'Content-Type':'application/json','Set-Cookie':cookieString('ao_pair',state,300)}});
  }
  if(path==='/api/auth/poll'&&method==='POST'){
   csrf(req);const state=hash(cookie(req,'ao_pair')),p=q('SELECT * FROM pairings WHERE hash=? AND expires>?').get(state,Date.now()) as any;if(!p)fail(400,'Sign-in expired. Please start again.');
   if(inflight.has(state))return json({pending:true});inflight.add(state);
   try{
    const result=await socialCall('desktop/exchange',{id:p.id,verifier:p.verifier});if(result.pending)return json({pending:true});
    const actor=result.actor;if(!actor?.id||!actor?.handle)fail(502,'Invalid account response.');
    // Revoke the temporary Social credential immediately; Office stores no Social password or access token.
    const revoke=await net(social+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+result.token},body:'{}',signal:AbortSignal.timeout(15000)});
    if(!revoke.ok)fail(502,'Could not finish secure sign-in. Please try again.');
    q('INSERT INTO users VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,handle=excluded.handle').run(actor.id,actor.name||actor.handle,actor.handle,Date.now());
    q('DELETE FROM pairings WHERE hash=?').run(state);q('DELETE FROM sessions WHERE expires<?').run(Date.now());
    const s=token();q('INSERT INTO sessions VALUES(?,?,?)').run(hash(s),actor.id,Date.now()+7*86400000);event(null,actor.id,'signin');
    return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Set-Cookie':cookieString('ao_session',s,7*86400)}});
   }finally{inflight.delete(state);}
  }
  if(path==='/api/logout'&&method==='POST'){csrf(req);q('DELETE FROM sessions WHERE hash=?').run(hash(cookie(req,'ao_session')));return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':cookieString('ao_session','',0)}});}
  if(path==='/api/warehouse/files'&&method==='GET'){
   const u=user(req);await planFor(u.id);if(!cloud)fail(503,'Warehouse is not connected yet.');const path=url.searchParams.get('path')||'';
   return json({files:(await cloud.list(u.id,path)).filter((f:any)=>!f.path.includes('/.history')&&(f.directory||allowed.has(f.name.split('.').pop()?.toLowerCase())))});
  }
  if(path==='/api/warehouse/open'&&method==='POST'){
   csrf(req);const u=user(req);await planFor(u.id);if(!cloud)fail(503,'Warehouse is not connected yet.');const b=await body(req);if(typeof b.path!=='string')fail(400,'Choose a Warehouse file.');
   const imported=await cloud.import(u.id,b.path),ext=imported.state.name.split('.').pop()?.toLowerCase()||'';if(!allowed.has(ext))fail(400,'Unsupported document format.');
   const existing=q('SELECT * FROM documents WHERE owner=? AND warehouse_id=? AND deleted=0').get(u.id,imported.state.id) as any;
   if(existing){if(existing.warehouse_path!==imported.state.path){q('UPDATE documents SET warehouse_path=? WHERE id=?').run(imported.state.path,existing.id);q('UPDATE versions SET warehouse_path=? WHERE doc=? AND revision=?').run(imported.state.path,existing.id,existing.revision);}return json({document:publicDoc(await cloud.open(doc(existing.id)))});}
   const id=randomBytes(16).toString('hex'),now=Date.now(),title=cleanTitle(imported.state.name.replace(/\.[^.]+$/,''));
   db.transaction(()=>{q('INSERT INTO documents(id,owner,title,ext,digest,size,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,u.id,title,ext,imported.digest,imported.bytes.length,now,now);q('INSERT INTO versions(doc,revision,digest,size,created) VALUES(?,?,?,?,?)').run(id,1,imported.digest,imported.bytes.length,now);event(id,u.id,'warehouse-opened');})();cloud.attach(id,imported.state);return json({document:publicDoc(doc(id))},201);
  }
  if(path==='/api/documents'&&method==='GET'){
   const u=user(req);const plan=await planFor(u.id);if(cloud)await cloud.migrate(u.id);const list=q(`SELECT d.*,CASE WHEN d.owner=? THEN 'owner' ELSE m.role END AS role FROM documents d LEFT JOIN members m ON m.doc=d.id AND m.user=? WHERE d.deleted=0 AND (d.owner=? OR m.user=?) ORDER BY d.updated DESC`).all(u.id,u.id,u.id,u.id);
   const used=cloud?(await cloud.usage(u.id)).usedBytes:(q('SELECT COALESCE(SUM(v.size),0) AS n FROM versions v JOIN documents d ON d.id=v.doc WHERE d.owner=?').get(u.id) as any).n;return json({documents:list.map(publicDoc),usedBytes:used,quotaBytes:quotaFor(u.id),plan:plan.plus?'plus':'free',sharedStorage:!!cloud});
  }
  if(path==='/api/documents'&&method==='POST'){
   csrf(req);const u=user(req);await planFor(u.id);rate('create:'+u.id,100);const b=await body(req);if(!['docx','xlsx','pptx'].includes(b.ext))fail(400,'Choose a document, spreadsheet, or presentation.');
   const template=assets['/templates/blank.'+b.ext];if(!template)fail(503,'Document templates are unavailable.');const bytes=Buffer.from(template.data,'base64');checkQuota(u.id,bytes.length);const digest=hash(bytes),id=randomBytes(16).toString('hex'),now=Date.now();
   const remote=cloud?await cloud.create(u.id,{id,title:cleanTitle(b.title),ext:b.ext},bytes):null;await store(bytes);
   db.transaction(()=>{checkQuota(u.id,bytes.length);q('INSERT INTO documents(id,owner,title,ext,digest,size,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,u.id,cleanTitle(b.title),b.ext,digest,bytes.length,now,now);q('INSERT INTO versions(doc,revision,digest,size,created) VALUES(?,?,?,?,?)').run(id,1,digest,bytes.length,now);event(id,u.id,'created');})();if(remote)cloud!.attach(id,remote);return json({document:publicDoc(doc(id))},201);
  }
  if(path==='/api/upload'&&method==='POST'){
   csrf(req);const u=user(req);await planFor(u.id);rate('upload:'+u.id,50);if(Number(req.headers.get('content-length')||0)>maxFile+65536)fail(413,'File too large.');const form=await req.formData(),file=form.get('file');if(!(file instanceof File))fail(400,'Choose a file.');
   const ext=file.name.split('.').pop()?.toLowerCase()||'';if(!allowed.has(ext))fail(400,'Unsupported document format.');if(file.size>maxFile)fail(413,'File too large.');checkQuota(u.id,file.size);const bytes=new Uint8Array(await file.arrayBuffer()),digest=hash(bytes),id=randomBytes(16).toString('hex'),now=Date.now();
   const remote=cloud?await cloud.create(u.id,{id,title:cleanTitle(file.name.replace(/\.[^.]+$/,'')),ext},bytes):null;await store(bytes);
   db.transaction(()=>{checkQuota(u.id,bytes.length);q('INSERT INTO documents(id,owner,title,ext,digest,size,created,updated) VALUES(?,?,?,?,?,?,?,?)').run(id,u.id,cleanTitle(file.name.replace(/\.[^.]+$/,'')),ext,digest,file.size,now,now);q('INSERT INTO versions(doc,revision,digest,size,created) VALUES(?,?,?,?,?)').run(id,1,digest,file.size,now);event(id,u.id,'uploaded');})();if(remote)cloud!.attach(id,remote);return json({document:publicDoc(doc(id))},201);
  }
  const match=path.match(/^\/api\/documents\/([a-f0-9]{32})(?:\/(config|download|share|members|versions))?$/);
  if(match){
   const [,id,action]=match;const u=user(req);let d=access(id,u);if(cloud&&['config','download','versions'].includes(action))d=await cloud.open(d);
   if(!action&&method==='PATCH'){csrf(req);access(id,u,true);const b=await body(req);if(cloud)await cloud.rename(d,cleanTitle(b.title));q('UPDATE documents SET title=?,updated=? WHERE id=?').run(cleanTitle(b.title),Date.now(),id);event(id,u.id,'renamed');return json({document:publicDoc(access(id,u))});}
   if(!action&&method==='DELETE'){csrf(req);owner(id,u);if(cloud)await cloud.remove(d);const versions=q('SELECT digest FROM versions WHERE doc=?').all(id) as any[];db.transaction(()=>{q('UPDATE documents SET deleted=1 WHERE id=?').run(id);q('DELETE FROM shares WHERE doc=?').run(id);q('DELETE FROM members WHERE doc=?').run(id);q('DELETE FROM versions WHERE doc=?').run(id);event(id,u.id,'deleted');})();for(const v of versions)if(!(q('SELECT 1 FROM versions WHERE digest=? LIMIT 1').get(v.digest))){try{unlinkSync(join(dir,'files',v.digest));}catch{}}return json({ok:true});}
   if(action==='download'&&method==='GET'){
    const rev=Number(url.searchParams.get('revision')||d.revision);const v=q('SELECT * FROM versions WHERE doc=? AND revision=?').get(id,rev) as any;if(!v)fail(404,'Version not found.');
    return new Response(cloud?await cloud.read(d,rev):Bun.file(join(dir,'files',v.digest)),{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(d.title+'.'+d.ext)}`}});
   }
   if(action==='versions'&&method==='GET')return json({versions:q('SELECT revision,size,created FROM versions WHERE doc=? ORDER BY revision DESC').all(id)});
   if(action==='config'&&method==='GET'){
    const key=id+'-'+d.epoch,edit=d.role!=='view'&&['docx','xlsx','pptx'].includes(d.ext);
    const config={document:{fileType:d.ext,key,title:d.title+'.'+d.ext,url:origin+'/files/'+id+'?token='+sign({scope:'download',id,key}),permissions:{edit,download:true,print:true,comment:edit,review:edit}},documentType:kind(d.ext),editorConfig:{mode:edit?'edit':'view',lang:'en',callbackUrl:origin+'/callbacks/'+id+'?token='+sign({scope:'callback',id,key}),user:{id:u.id,name:u.name},coEditing:{mode:'fast',change:true},customization:{uiTheme:'theme-light',forcesave:true,autosave:true,goback:{url:origin},help:true,feedback:false}},type:(url.searchParams.get('mobile')==='1'||/Android|iPhone|iPad|Mobile/i.test(req.headers.get('user-agent')||''))?'mobile':'desktop'};
    return json({config:{...config,token:jwt(config,editorSecret)},docsUrl:docs,document:publicDoc(d)});
   }
   if(action==='share'){
    owner(id,u);
    if(method==='GET')return json({members:q('SELECT u.id,u.name,u.handle,m.role FROM members m JOIN users u ON u.id=m.user WHERE m.doc=?').all(id),links:q('SELECT substr(hash,1,12) AS id,role,expires FROM shares WHERE doc=? AND expires>?').all(id,Date.now())});
    if(method==='POST'){csrf(req);const b=await body(req);if(!['edit','view'].includes(b.role))fail(400,'Choose view or edit.');const t=token();q('INSERT INTO shares VALUES(?,?,?,?,?)').run(hash(t),id,b.role,Date.now()+7*86400000,Date.now());event(id,u.id,'share-created');return json({url:origin+'/join#'+t,role:b.role});}
    if(method==='DELETE'){csrf(req);q('DELETE FROM shares WHERE doc=?').run(id);q('DELETE FROM members WHERE doc=?').run(id);event(id,u.id,'sharing-revoked');return json({ok:true});}
   }
   fail(405,'Method not supported.');
  }
  if(path==='/api/join'&&method==='POST'){
   csrf(req);const u=user(req),b=await body(req),s=q('SELECT * FROM shares WHERE hash=? AND expires>?').get(hash(String(b.token||'')),Date.now()) as any;if(!s)fail(404,'This invitation expired or was revoked.');const d=doc(s.doc);
   if(d.owner!==u.id)q(`INSERT INTO members VALUES(?,?,?) ON CONFLICT(doc,user) DO UPDATE SET role=CASE WHEN members.role='edit' THEN 'edit' ELSE excluded.role END`).run(d.id,u.id,s.role);event(d.id,u.id,'joined');return json({id:d.id});
  }
  const download=path.match(/^\/files\/([a-f0-9]{32})$/);
  if(download&&method==='GET'){const id=download[1],c=verify(url.searchParams.get('token')||'','download',id),d=doc(id);if(c.key!==id+'-'+d.epoch)fail(403,'Editing session expired.');return new Response(cloud?await cloud.read(d):Bun.file(join(dir,'files',d.digest)),{headers:{'Content-Type':'application/octet-stream'}});}
  const callback=path.match(/^\/callbacks\/([a-f0-9]{32})$/);
  if(callback&&method==='POST'){
   const id=callback[1],c=verify(url.searchParams.get('token')||'','callback',id),b=await body(req,1024*1024);let signed:any;
   try{signed=verifyJwt(b.token||(req.headers.get('authorization')||'').replace(/^Bearer /,''),editorSecret);}catch{fail(403,'Unsigned editor callback rejected.');}
   const payload=signed.payload||signed;
   if(payload.key!==c.key||b.key!==c.key||payload.status!==b.status||payload.url!==b.url)fail(403,'Editor callback does not match its signature.');
   const d=doc(id);if(c.key!==id+'-'+d.epoch)return json({error:0});
   if([2,6].includes(b.status)){
    await planFor(d.owner);
    const target=new URL(payload.url);if(![docs,env.DOCS_PREVIOUS_URL].filter(Boolean).some((value:string)=>target.origin===new URL(value).origin))fail(403,'Untrusted editor download URL.');
    const response=await net(target,{redirect:'error',signal:AbortSignal.timeout(45000)});if(!response.ok)fail(502,'Editor save download failed.');
    if(Number(response.headers.get('content-length')||0)>maxFile)fail(413,'Edited file too large.');
    const chunks:Uint8Array[]=[];let size=0;for await(const chunk of response.body as any){size+=chunk.byteLength;if(size>maxFile)fail(413,'Edited file too large.');chunks.push(chunk);}
    const bytes=Buffer.concat(chunks);if(hash(bytes)!==d.digest){checkQuota(d.owner,size);const digest=await store(bytes),now=Date.now();
     const commit=(current:any)=>{checkQuota(d.owner,size);q('UPDATE documents SET digest=?,size=?,revision=revision+1,updated=? WHERE id=?').run(digest,size,now,id);q('INSERT INTO versions(doc,revision,digest,size,created) VALUES(?,?,?,?,?)').run(id,current.revision+1,digest,size,now);event(id,null,'saved');};if(cloud)await cloud.save(d,bytes,commit);else db.transaction(()=>{const current=doc(id);if(current.epoch===d.epoch)commit(current);})();
    }
    if(b.status===2)q('UPDATE documents SET epoch=epoch+1 WHERE id=? AND epoch=?').run(id,d.epoch);
   }
   return json({error:0});
  }
  if(method==='GET'){
   let asset=assets[path];if(path==='/'||path==='/join'||path==='/warehouse-open'||/^\/edit\/[a-f0-9]{32}$/.test(path))asset=assets['/index.html'];
   if(asset&&!path.startsWith('/templates/'))return new Response(Buffer.from(asset.data,'base64'),{headers:{'Content-Type':asset.type}});
  }
  fail(404,'Not found.');
 }
 async function fetchHandler(req:Request){
  let response:Response;
  try{response=await handle(req);}catch(error:any){const status=error.status||500;if(status>=500)console.error('office_request_failed',status,error.message);response=json({error:status<500?error.message:'Office could not complete this request. Please try again.'},status);}
  response.headers.set('Cache-Control','no-store');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('Referrer-Policy','no-referrer');
  response.headers.set('Content-Security-Policy',`default-src 'self'; script-src 'self' ${docs}; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${docs}; frame-src ${docs}; frame-ancestors 'self'; base-uri 'self'; form-action 'self'`);
  response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');return response;
 }
 return {fetch:fetchHandler,db,close:()=>db.close()};
}
if(import.meta.main){const app=createOffice();Bun.serve({port:Number(process.env.PORT||3000),hostname:'0.0.0.0',maxRequestBodySize:26*1024*1024,fetch:app.fetch});console.log('AltOffice is listening.');}
