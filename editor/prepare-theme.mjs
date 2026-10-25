import {cpSync,readFileSync,writeFileSync,readdirSync,statSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
const root=process.argv[2];if(!root)throw Error('Supply the Euro-Office web-apps source directory.');
const theme=join(root,'theme/altoffice');cpSync(join(root,'theme/euro-office'),theme,{recursive:true});
const config=JSON.parse(readFileSync(join(theme,'meta/config.json'),'utf8'));
Object.assign(config,{company_name:'Artemis Softworks LLC',publisher_name:'Artemis Softworks LLC',publisher_url:'https://altstack.org',app_title:'AltOffice',support_url:'https://github.com/danecohn/AmerikaOffice/issues',help_url:'https://github.com/danecohn/AmerikaOffice',attribution:'AltOffice is based on Euro-Office, which is based on ONLYOFFICE by Ascensio System SIA.'});
writeFileSync(join(theme,'meta/config.json'),JSON.stringify(config,null,2));
const aboutPath=join(theme,'meta/about.json'),about=JSON.parse(readFileSync(aboutPath,'utf8'));
about.blocks.unshift({text:'AltOffice is the Artemis Softworks LLC edition of Euro-Office. Modified on {buildDate}. Artemis Softworks LLC is not affiliated with Euro-Office or Ascensio System SIA.'});
about.blocks.push({text:'AltOffice modifications, build scripts, exact upstream commits, and corresponding source: [AltOffice source]({downstreamSourceUrl}).'});
writeFileSync(aboutPath,JSON.stringify(about,null,2));
const renderer=join(root,'build/about-html.mjs'),renderSource=readFileSync(renderer,'utf8');
if(!renderSource.includes('const urls = {'))throw Error('Review the pinned About renderer before patching source links.');
writeFileSync(renderer,renderSource.replace('const urls = {',"const urls = { downstreamSourceUrl: 'https://github.com/danecohn/AmerikaOffice/tree/altstack/euro-office-editor',"));
const logo=readFileSync(process.argv[3]||'/tmp/brand/logo.svg','utf8');
function logos(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())logos(p);else if(/\.svg$/.test(name)&&/logo/i.test(name))writeFileSync(p,logo);}}
logos(join(theme,'assets/img'));
const less=join(theme,'assets/less/theme.less');writeFileSync(less,readFileSync(less,'utf8').replace('@nc-primary: #0082c9;','@nc-primary: #0066cc;'));
console.log('Prepared the AltOffice theme from the pinned Euro-Office theme.');

// Apply the actual editor interface, not only the distribution logo.
const companionCSS=readFileSync(join(dirname(process.argv[3]||'/tmp/brand/logo.svg'),'companion.css'),'utf8');
const companionJS=readFileSync(join(dirname(process.argv[3]||'/tmp/brand/logo.svg'),'companion.js'),'utf8');
let interfaces=0;
for(const app of readdirSync(join(root,'apps'))){for(const mode of ['main','mobile']){
 for(const entry of ['index.html','index.html.deploy']){const html=join(root,'apps',app,mode,entry);if(!existsSync(html))continue;
 let source=readFileSync(html,'utf8');if(source.includes('asw-companion-style'))continue;
 source=source.replace(/maximum-scale=1\.0,?\s*|minimum-scale=1\.0,?\s*|user-scalable=no,?\s*/g,'');
 source=source.replace('</head>','<style id="asw-companion-style">'+companionCSS+'</style></head>');
 if(mode==='main')source=source.replace('</body>','<script id="asw-companion-actions">'+companionJS+'</script></body>');
 writeFileSync(html,source);interfaces++;
}}}
if(interfaces<3)throw Error('Expected document, spreadsheet and presentation editor entrypoints.');
console.log('Applied Artemis Companion surfaces and Actions to '+interfaces+' editor interfaces.');

const mobileTheme=join(theme,'assets/less/overrides/mobile-overrides.less');
writeFileSync(mobileTheme,readFileSync(mobileTheme,'utf8')+'\n'+readFileSync(join(dirname(process.argv[3]||'/tmp/brand/logo.svg'),'companion-mobile.css'),'utf8'));
