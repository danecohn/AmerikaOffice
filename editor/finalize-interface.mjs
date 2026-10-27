import {readFileSync,writeFileSync,existsSync,readdirSync,cpSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync,brotliCompressSync,constants} from 'node:zlib';
// Verify the delivered artifact after upstream release-template processing.
const output=process.argv[2],assets=process.argv[3]||join(dirname(fileURLToPath(import.meta.url)),'brand');
if(!output)throw Error('Supply the compiled frontend root containing web-apps.');
const css=readFileSync(join(assets,'companion.css'),'utf8'),js=readFileSync(join(assets,'companion.js'),'utf8'),mobile=readFileSync(join(assets,'companion-mobile.css'),'utf8');
cpSync(join(assets,'vigiltech'),join(output,'web-apps/vigiltech'),{recursive:true});
const apps=join(output,'web-apps/apps'),required=['documenteditor','spreadsheeteditor','presentationeditor'];let count=0;
for(const app of readdirSync(apps)){for(const mode of ['main','mobile']){for(const name of ['index.html','index_loader.html']){
 const path=join(apps,app,mode,name);if(!existsSync(path))continue;let html=readFileSync(path,'utf8');
 html=html.replace(/<style id="asw-companion-style">[\s\S]*?<\/style>/g,'').replace(/<script id="asw-companion-actions">[\s\S]*?<\/script>/g,'');
 html=html.replace(/,\s*(?:maximum-scale|minimum-scale|user-scalable)=[^",>]+/g,'');
 html=html.replace('</head>','<link rel="stylesheet" href="/web-apps/vigiltech/css/vigilsans.css"><link rel="stylesheet" href="/web-apps/vigiltech/css/goldengate.css"><style id="asw-companion-style">'+(mode==='mobile'?mobile:css)+'</style></head>');
 if(mode==='main')html=html.replace('</body>','<script id="asw-companion-actions">'+js+'</script></body>');
 if(!html.includes('id="asw-companion-style"')||(mode==='main'&&!html.includes('id="asw-companion-actions"')))throw Error('Companion injection failed: '+path);
 writeFileSync(path,html);writeFileSync(path+'.gz',gzipSync(html,{level:9}));writeFileSync(path+'.br',brotliCompressSync(html,{params:{[constants.BROTLI_PARAM_QUALITY]:9}}));count++;
}}}
for(const app of required){const path=join(apps,app,'main/index.html');if(!existsSync(path)||!readFileSync(path,'utf8').includes('asw-companion-actions'))throw Error('Missing delivered Companion editor: '+app);}
console.log('Verified Companion interface in '+count+' compiled editor entrypoints (including compressed variants).');
