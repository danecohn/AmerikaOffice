from pathlib import Path
import hashlib,shutil,json,os

matrix=[('x86_64-pc-windows-msvc','windows','x64','exe'),('aarch64-pc-windows-msvc','windows','arm64','exe'),('x86_64-apple-darwin','mac','x64','dmg'),('aarch64-apple-darwin','mac','arm64','dmg'),('x86_64-unknown-linux-gnu','linux','x64','deb'),('aarch64-unknown-linux-gnu','linux','arm64','deb')]
out=Path('release-files');out.mkdir(exist_ok=True)
manifest=[]
for target,platform,arch,extension in matrix:
 matches=list((Path('installers')/('installer-'+target)).rglob('*.'+extension))
 if len(matches)!=1: raise SystemExit(f'Expected one {target} installer, found {len(matches)}')
 source=matches[0]
 if source.stat().st_size<10_000_000: raise SystemExit(f'Installer unexpectedly small: {source}')
 name=f'AltOffice-{platform}-{arch}.{extension}'
 dest=out/name;shutil.copyfile(source,dest)
 digest=hashlib.file_digest(dest.open('rb'),'sha256').hexdigest()
 (out/(name+'.sha256')).write_text(digest+'  '+name+'\n')
 manifest.append(dict(platform=platform,arch=arch,name=name,sha256=digest,size=dest.stat().st_size))
(out/'AltOffice-downloads.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'SOURCE.txt').write_text('AltOffice 0.2.0 by Artemis Softworks LLC\nComplete downstream source/build overlay: https://github.com/danecohn/AmerikaOffice/tree/'+os.environ['GITHUB_SHA']+'/desktop-native\nPinned Euro-Office Lite source: https://github.com/delmarguillen/euro-office-lite/tree/41558fdbff7b5248f5f302b3b2b6a189178a447f\nSubmodule commits are recorded by that upstream commit. Original licenses and converter source notices are retained.\n')
print('Prepared six installers and SHA-256 files for publication.')
