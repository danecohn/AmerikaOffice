import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';import {strict as assert} from 'node:assert';import {gunzipSync,brotliDecompressSync} from 'node:zlib';
const out=mkdtempSync(join(tmpdir(),'cohnsoft-editor-'));
try{
 for(const app of ['documenteditor','spreadsheeteditor','presentationeditor'])for(const mode of ['main','mobile']){const dir=join(out,'web-apps/apps',app,mode);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'index.html'),'<html><head><meta name="viewport" content="width=device-width, user-scalable=no"></head><body>Euro-Office · Ascensio System SIA · AGPL</body></html>')}
 const result=spawnSync(process.execPath,['editor/finalize-interface.mjs',out,'editor/brand'],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 for(const app of ['documenteditor','spreadsheeteditor','presentationeditor'])for(const mode of ['main','mobile']){const file=join(out,'web-apps/apps',app,mode,'index.html'),html=readFileSync(file,'utf8');assert.ok(html.includes('Euro-Office · Ascensio System SIA · AGPL'));assert.ok(html.includes('/web-apps/cohnsoft/css/cohnsans.css'));assert.ok(!html.includes('user-scalable=no'));if(mode==='main')assert.ok(html.includes('Cohnsoft Office Actions'));assert.equal(gunzipSync(readFileSync(file+'.gz')).toString(),html);assert.equal(brotliDecompressSync(readFileSync(file+'.br')).toString(),html)}
 assert.deepEqual(readFileSync(join(out,'web-apps/cohnsoft/fonts/CohnSans-Regular.woff2')),readFileSync('editor/brand/cohnsoft/fonts/CohnSans-Regular.woff2'));
 console.log('Verified all six editor entrypoints, preserved notices, local fonts and compressed artifacts.');
}finally{rmSync(out,{recursive:true,force:true})}
