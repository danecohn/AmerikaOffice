"""AltStack's build overlay for pinned Euro-Office Lite sources (AGPL-3.0)."""
from pathlib import Path
import base64,json,shutil

root=Path.cwd()
overlay=Path(__file__).resolve().parents[1]
conf_path=root/'src-tauri/tauri.conf.json'
conf=json.loads(conf_path.read_text())
conf.update(productName='AltOffice',mainBinaryName='altoffice',identifier='io.altstack.office',version='0.2.0')
for window in conf['app']['windows']: window['title']='AltOffice'
conf['bundle']['publisher']='Artemis Softworks LLC'
conf['bundle']['copyright']='AltStack LLC; upstream copyrights retained in licenses and source notices.'
conf_path.write_text(json.dumps(conf,indent=2)+'\n')

# Only change first-party product UI. Keep upstream licenses, dictionaries,
# converter binaries, compatibility identifiers and third-party source notices.
for folder in ['src','src-tauri/src']:
 for p in (root/folder).glob('*'):
  if p.suffix in ('.html','.js','.rs'):
   text=p.read_text('utf-8').replace('Euro-Office Lite','AltOffice').replace('Euro Office Lite','AltOffice')
   p.write_text(text,encoding='utf-8')

icons=root/'src-tauri/icons'
for filename in ['icon.ico','icon.icns','icon.png']:
 shutil.copyfile(overlay/'desktop/assets'/filename,icons/filename)
for filename in ['32x32.png','128x128.png','128x128@2x.png','256x256.png']:
 shutil.copyfile(overlay/'desktop/assets/icon.png',icons/filename)

html=root/'src/index.html'
text=html.read_text('utf-8')
logo=base64.b64encode((overlay/'desktop/assets/icon.png').read_bytes()).decode()
text=text.replace('<h1>AltOffice</h1>',f'<h1><img src="data:image/png;base64,{logo}" width="60" height="60" style="vertical-align:middle;border-radius:12px;margin-right:15px" alt="">AltOffice</h1>')
text=text.replace('</head>','''<style>
body{background:radial-gradient(ellipse at top,#fff,#e7edf3 70%);color:#233649}
button,.btn{background:linear-gradient(#fff,#dce7f1);border:1px solid #aebdcb;color:#233649;box-shadow:inset 0 1px white,0 4px 12px #23364915}
h1{color:#233649;text-shadow:0 1px white}
.altstack-source{font:12px/1.6 system-ui;color:#52677c;margin:28px auto;max-width:620px;text-align:center}.altstack-source a{color:#1764bd}
</style></head>''')
text=text.replace('</body>','''<p class="altstack-source">AltOffice by Artemis Softworks LLC. Based on Euro-Office Lite and Euro-Office editors.<br>
<a href="https://github.com/danecohn/AmerikaOffice/tree/altstack/desktop-releases/desktop-native" target="_blank">Source, changes &amp; licenses</a> Â· Local files stay on this computer.</p></body>''')
html.write_text(text,encoding='utf-8')

build=root/'scripts/build-frontend-prod.mjs'
text=build.read_text('utf-8').replace("COMPANY_NAME: 'Euro-Office'","COMPANY_NAME: 'Artemis Softworks LLC'").replace("PRODUCT_NAME: 'Euro-Office Lite'","PRODUCT_NAME: 'AltOffice'").replace("PUBLISHER_NAME: 'Euro-Office contributors'","PUBLISHER_NAME: 'Artemis Softworks LLC'")
# Retain the original APP_COPYRIGHT and upstream About/legal blocks.
build.write_text(text,encoding='utf-8')
theme=root/'src/web-apps/theme/euro-office'
if theme.exists():
 for p in theme.rglob('*.svg'):
  if 'logo' in p.name.lower(): shutil.copyfile(overlay/'desktop/assets/logo.svg',p)
 config=theme/'meta/config.json'
 if config.exists():
  data=json.loads(config.read_text())
  data.update(company_name='Artemis Softworks LLC',publisher_name='Artemis Softworks LLC',app_title='AltOffice')
  config.write_text(json.dumps(data,indent=2)+'\n')
for filename in ['scripts/get-x2t-ci.sh','scripts/get-x2t-ci.ps1']:
 p=root/filename;text=p.read_text('utf-8')
 text=text.replace('REPO="${GITHUB_REPOSITORY:-delmarguillen/euro-office-lite}"','REPO="delmarguillen/euro-office-lite"').replace('$repo = $env:GITHUB_REPOSITORY','$repo = "delmarguillen/euro-office-lite"')
 p.write_text(text,encoding='utf-8')
print('Applied AltOffice branding and preserved upstream notices.')
