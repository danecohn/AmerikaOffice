"""Cohnsoft's build overlay for pinned Euro-Office Lite sources (AGPL-3.0)."""
from pathlib import Path
import base64,json,shutil

root=Path.cwd()
overlay=Path(__file__).resolve().parents[1]
conf_path=root/'src-tauri/tauri.conf.json'
conf=json.loads(conf_path.read_text(encoding='utf-8'))
conf.update(productName='Cohnsoft Office',mainBinaryName='altoffice',identifier='io.altstack.office',version='0.4.0')
for window in conf['app']['windows']: window['title']='Cohnsoft Office'
conf['bundle']['publisher']='Cohnsoft'
conf['bundle']['copyright']='Cohnsoft; upstream copyrights retained in licenses and source notices.'
conf_path.write_text(json.dumps(conf,indent=2)+'\n',encoding='utf-8')

# Only change first-party product UI. Keep upstream licenses, dictionaries,
# converter binaries, compatibility identifiers and third-party source notices.
for folder in ['src','src-tauri/src']:
 for p in (root/folder).glob('*'):
  if p.suffix in ('.html','.js','.rs'):
   text=p.read_text('utf-8').replace('Euro-Office Lite','Cohnsoft Office').replace('Euro Office Lite','Cohnsoft Office')
   p.write_text(text,encoding='utf-8')

icons=root/'src-tauri/icons'
for filename in ['icon.ico','icon.icns','icon.png']:
 shutil.copyfile(overlay/'desktop/assets'/filename,icons/filename)
for filename,size in [('32x32.png',32),('128x128.png',128),('128x128@2x.png',256),('256x256.png',256)]:
 shutil.copyfile(overlay/f'desktop/assets/icon-{size}.png',icons/filename)

html=root/'src/index.html'
text=html.read_text('utf-8')
logo=base64.b64encode((overlay/'desktop/assets/icon.png').read_bytes()).decode()
text=text.replace('<h1>Cohnsoft Office</h1>',f'<h1><img src="data:image/png;base64,{logo}" width="60" height="60" style="vertical-align:middle;border-radius:12px;margin-right:15px" alt="">Cohnsoft Office</h1>')
text=text.replace('</head>','''<link rel="stylesheet" href="web-apps/cohnsoft/css/cohnsans.css"><link rel="stylesheet" href="web-apps/cohnsoft/css/goldengate.css"><style>
body{font-family:"Cohn Sans",system-ui,-apple-system,sans-serif;background:#f2f2f7;color:#1d1d1f} button:focus-visible,a:focus-visible{outline:3px solid #0a7a37;outline-offset:3px}
button,.btn{border-radius:18px;min-height:44px;background:#fff;border:1px solid #d5dce8;color:#1d1d1f;box-shadow:inset 0 1px white,0 4px 12px #1d1d1f15}
h1{color:#1d1d1f;text-shadow:0 1px white}
.altstack-source{font:12px/1.6 "Cohn Sans",system-ui;color:#62646b;margin:28px auto;max-width:620px;text-align:center}.altstack-source a{color:#0a7a37}
</style></head>''')
text=text.replace('</body>','''<p class="altstack-source">Cohnsoft Office. A product of Cohnsoft. Based on Euro-Office Lite and Euro-Office editors.<br>
<a href="https://github.com/danecohn/AmerikaOffice/tree/altstack/desktop-releases/desktop-native" target="_blank">Source, changes &amp; licenses</a> · Local files stay on this computer.</p></body>''')
html.write_text(text,encoding='utf-8')

build=root/'scripts/build-frontend-prod.mjs'
text=build.read_text('utf-8').replace("COMPANY_NAME: 'Euro-Office'","COMPANY_NAME: 'Cohnsoft'").replace("PRODUCT_NAME: 'Euro-Office Lite'","PRODUCT_NAME: 'Cohnsoft Office'").replace("PUBLISHER_NAME: 'Euro-Office contributors'","PUBLISHER_NAME: 'Cohnsoft'")
# Retain the original APP_COPYRIGHT and upstream About/legal blocks.
build.write_text(text,encoding='utf-8')
theme=root/'src/web-apps/theme/euro-office'
if theme.exists():
 for p in theme.rglob('*.svg'):
  if 'logo' in p.name.lower(): shutil.copyfile(overlay/'desktop/assets/logo.svg',p)
 config=theme/'meta/config.json'
 if config.exists():
  data=json.loads(config.read_text(encoding='utf-8'))
  data.update(company_name='Cohnsoft',publisher_name='Cohnsoft',app_title='Cohnsoft Office')
  config.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
for filename in ['scripts/get-x2t-ci.sh','scripts/get-x2t-ci.ps1']:
 p=root/filename;text=p.read_text('utf-8')
 text=text.replace('REPO="${GITHUB_REPOSITORY:-delmarguillen/euro-office-lite}"','REPO="delmarguillen/euro-office-lite"').replace('$repo = $env:GITHUB_REPOSITORY','$repo = "delmarguillen/euro-office-lite"')
 p.write_text(text,encoding='utf-8')
print('Applied Cohnsoft Office branding and preserved upstream notices.')

# Apply the same editor presentation and command workflow in the offline desktop build.
companion_css=(overlay/'desktop-native/companion.css').read_text(encoding='utf-8')
companion_js=(overlay/'desktop-native/companion.js').read_text(encoding='utf-8')
entries=0
for html in (root/'src/web-apps/apps').glob('*/main/index.html*'):
 text=html.read_text(encoding='utf-8')
 if 'asw-companion-style' in text: continue
 text=text.replace('</head>','<style id="asw-companion-style">'+companion_css+'</style></head>')
 text=text.replace('</body>','<script id="asw-companion-actions">'+companion_js+'</script></body>')
 html.write_text(text,encoding='utf-8');entries+=1
if entries < 3: raise RuntimeError('Expected document, spreadsheet and presentation native editor entrypoints')
print('Applied Companion interface and Actions to',entries,'native editors')

mobile_theme=root/'src/web-apps/theme/euro-office/assets/less/overrides/mobile-overrides.less'
if mobile_theme.exists():mobile_theme.write_text(mobile_theme.read_text(encoding='utf-8')+'\n'+(overlay/'desktop-native/companion-mobile.css').read_text(encoding='utf-8'),encoding='utf-8')

# The release build uses .deploy templates. Enforce the interface on final src-dist artifacts, too.
frontend_script=root/'scripts/build-frontend-prod.mjs'
text=frontend_script.read_text(encoding='utf-8')
text+="\nrun(process.execPath,[path.join(projectRoot,'.altstack-source','desktop-native','finalize-interface.mjs'),outputRoot,path.join(projectRoot,'.altstack-source','desktop-native')],projectRoot);\n"
frontend_script.write_text(text,encoding='utf-8')
