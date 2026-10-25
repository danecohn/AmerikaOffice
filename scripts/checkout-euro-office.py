#!/usr/bin/env python3
"""Materialize the pinned Euro-Office source fork with Makk Office build branding."""
import argparse,json,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
lock=json.loads((ROOT/'upstream/euro-office.lock.json').read_text())['desktop']
p=argparse.ArgumentParser();p.add_argument('destination',type=Path);p.add_argument('--with-submodules',action='store_true');args=p.parse_args()
if args.destination.exists():raise SystemExit('Use a new directory; existing source is never overwritten.')
subprocess.run(['git','clone','--no-checkout',lock['repository'],str(args.destination)],check=True)
subprocess.run(['git','checkout','--detach',lock['commit']],cwd=args.destination,check=True)
if args.with_submodules:subprocess.run(['git','submodule','update','--init','--recursive'],cwd=args.destination,check=True)
for rel in ('build/docker-bake.hcl','build/linux/docker-bake.hcl'):
 path=args.destination/rel;text=path.read_text().replace('default = "Euro-Office"','default = "Artemis Softworks LLC"').replace('default = "Desktop Editors"','default = "Makk Office"');path.write_text(text)
print('Euro-Office source fork prepared at',args.destination)
print('Build from its build directory: docker buildx bake -f docker-bake.hcl desktop-linux')
