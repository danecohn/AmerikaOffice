from pathlib import Path
import os,subprocess,platform
root=Path(__file__).resolve().parent
arch='arm64'if platform.machine().lower()in['arm64','aarch64']else'x64'
if platform.system()=='Linux':exe=root/'release'/('linux-arm64-unpacked'if arch=='arm64'else'linux-unpacked')/'amerika-office'
elif platform.system()=='Windows':exe=root/'release'/('win-arm64-unpacked'if arch=='arm64'else'win-unpacked')/'Vigil Office.exe'
else:exe=root/'release'/('mac-arm64'if arch=='arm64'else'mac')/'Vigil Office.app/Contents/MacOS/Vigil Office'
out=root/'release'/('office-smoke-'+platform.system()+'-'+arch+'.png');subprocess.run([str(exe),'--disable-gpu','--smoke-test',str(out)],check=True,timeout=60)
assert out.exists()and out.stat().st_size>10000,'No valid Office preview was captured.'
print('Native desktop smoke test passed:',platform.system(),arch)
