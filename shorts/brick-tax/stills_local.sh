#!/bin/bash
# usage: stills_local.sh TAG FRAME...  (cloud check stills, uses preinstalled headless shell)
cd "$(dirname "$0")"; tag=$1; shift; mkdir -p stills
HS=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
for f in "$@"; do
  npx remotion still src/index.jsx Story stills/${tag}_$(printf %04d $f).png --frame=$f --scale=0.5 --gl=swangle --browser-executable=$HS 2>&1 | grep -iE "error|fail" | head -3 &
done; wait
python3 - "$tag" <<'PY'
import sys,glob
from PIL import Image, ImageDraw
tag=sys.argv[1]; fs=sorted(glob.glob(f"stills/{tag}_*.png"))
ims=[Image.open(f) for f in fs]; w,h=ims[0].size; cols=6; rows=(len(ims)+cols-1)//cols
sheet=Image.new('RGB',(cols*w,rows*h),'black'); d=ImageDraw.Draw(sheet)
for i,(f,im) in enumerate(zip(fs,ims)):
    x,y=(i%cols)*w,(i//cols)*h; sheet.paste(im,(x,y)); d.text((x+6,y+6),f.split('_')[-1][:-4],fill='red')
sheet.save(f"stills/sheet_{tag}.jpg",quality=85); print("sheet", f"stills/sheet_{tag}.jpg", len(ims))
PY
