import {readdir} from 'node:fs/promises';
async function files(dir:string):Promise<string[]>{const result:string[]=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())result.push(...await files(p));else if(e.isFile())result.push(p);}return result;}
const assets:Record<string,{type:string,data:string}>={};
const mime:Record<string,string>={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',png:'image/png',ico:'image/x-icon',json:'application/json',svg:'image/svg+xml',ttf:'font/ttf',woff2:'font/woff2',webmanifest:'application/manifest+json',txt:'text/plain; charset=utf-8'};
for(const folder of ['public','templates'])for(const path of await files(folder)){
 const name=path.slice(folder.length+1);
 const f=Bun.file(folder+'/'+name),ext=name.split('.').pop()||'';
 assets[(folder==='public'?'/':'/templates/')+name]={type:mime[ext]||'application/octet-stream',data:Buffer.from(await f.arrayBuffer()).toString('base64')};
}
const source=await Bun.file('server.ts').text();await Bun.write('dist/server.ts',source.replace('const ASSETS: Record<string,{type:string,data:string}> = {}; // BUNDLE_ASSETS','const ASSETS = '+JSON.stringify(assets)+';'));
console.log('Bundled '+Object.keys(assets).length+' assets.');

for(const name of ['warehouse.ts','cloud-files.ts'])await Bun.write('dist/'+name,Bun.file(name));
