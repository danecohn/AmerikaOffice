import {cpSync,readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.argv[2];if(!root)throw Error('Supply the Euro-Office web-apps source directory.');
const theme=join(root,'theme/altoffice');cpSync(join(root,'theme/euro-office'),theme,{recursive:true});
const config=JSON.parse(readFileSync(join(theme,'meta/config.json'),'utf8'));
Object.assign(config,{company_name:'AltStack LLC',publisher_name:'AltStack LLC',publisher_url:'https://altstack.org',app_title:'AltOffice',support_url:'https://github.com/danecohn/AmerikaOffice/issues',help_url:'https://github.com/danecohn/AmerikaOffice',attribution:'AltOffice is based on Euro-Office, which is based on ONLYOFFICE by Ascensio System SIA.'});
writeFileSync(join(theme,'meta/config.json'),JSON.stringify(config,null,2));
const aboutPath=join(theme,'meta/about.json'),about=JSON.parse(readFileSync(aboutPath,'utf8'));
about.blocks.unshift({text:'AltOffice is the AltStack LLC edition of Euro-Office. Modified on {buildDate}. AltStack LLC is not affiliated with Euro-Office or Ascensio System SIA.'});
about.blocks.push({text:'AltOffice modifications, build scripts, exact upstream commits, and corresponding source: [AltOffice source]({downstreamSourceUrl}).'});
writeFileSync(aboutPath,JSON.stringify(about,null,2));
const renderer=join(root,'build/about-html.mjs'),renderSource=readFileSync(renderer,'utf8');
if(!renderSource.includes('const urls = {'))throw Error('Review the pinned About renderer before patching source links.');
writeFileSync(renderer,renderSource.replace('const urls = {',"const urls = { downstreamSourceUrl: 'https://github.com/danecohn/AmerikaOffice/tree/altstack/euro-office-editor',"));
const logo=readFileSync(process.argv[3]||'/tmp/brand/logo.svg','utf8');
function logos(dir){for(const name of readdirSync(dir)){const p=join(dir,name);if(statSync(p).isDirectory())logos(p);else if(/\.svg$/.test(name)&&/logo/i.test(name))writeFileSync(p,logo);}}
logos(join(theme,'assets/img'));
const less=join(theme,'assets/less/theme.less');writeFileSync(less,readFileSync(less,'utf8').replace('@nc-primary: #0082c9;','@nc-primary: #1764bd;'));
console.log('Prepared the AltOffice theme from the pinned Euro-Office theme.');
