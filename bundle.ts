import {readdir} from 'node:fs/promises';
const assets:Record<string,{type:string,data:string}>={};
const mime:Record<string,string>={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',ttf:'font/ttf',woff2:'font/woff2',webmanifest:'application/manifest+json',txt:'text/plain; charset=utf-8',png:'image/png',ico:'image/x-icon'};
const walk=async(dir:string,prefix:string):Promise<void>=>{
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(entry.isDirectory()){await walk(dir+'/'+entry.name,prefix+entry.name+'/');continue;}
  const f=Bun.file(dir+'/'+entry.name),ext=entry.name.split('.').pop()||'';
  assets[prefix+entry.name]={type:mime[ext]||'application/octet-stream',data:Buffer.from(await f.arrayBuffer()).toString('base64')};
 }
};
await walk('public','/');await walk('templates','/templates/');
const source=await Bun.file('server.ts').text();await Bun.write('dist/server.ts',source.replace('const ASSETS: Record<string,{type:string,data:string}> = {}; // BUNDLE_ASSETS','const ASSETS = '+JSON.stringify(assets)+';'));
console.log('Bundled '+Object.keys(assets).length+' assets.');
