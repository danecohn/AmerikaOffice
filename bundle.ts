import {readdir} from 'node:fs/promises';
const assets:Record<string,{type:string,data:string}>={};
const mime:Record<string,string>={html:'text/html; charset=utf-8',css:'text/css; charset=utf-8',js:'text/javascript; charset=utf-8',svg:'image/svg+xml',ttf:'font/ttf',woff2:'font/woff2',webmanifest:'application/manifest+json',txt:'text/plain; charset=utf-8'};
for(const folder of ['public','templates'])for(const name of await readdir(folder)){
 const f=Bun.file(folder+'/'+name),ext=name.split('.').pop()||'';
 assets[(folder==='public'?'/':'/templates/')+name]={type:mime[ext]||'application/octet-stream',data:Buffer.from(await f.arrayBuffer()).toString('base64')};
}
const source=await Bun.file('server.ts').text();await Bun.write('dist/server.ts',source.replace('const ASSETS: Record<string,{type:string,data:string}> = {}; // BUNDLE_ASSETS','const ASSETS = '+JSON.stringify(assets)+';'));
console.log('Bundled '+Object.keys(assets).length+' assets.');
