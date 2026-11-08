#!/usr/bin/env python3
"""use_logo.py — put the current XR app logo into XR CODE (idempotent, always refreshes):
- topbar logo slots (left + right): 96px logo (alpha kept)
- in-app favicon: 64px logo
- src/app/icon.png: 512px logo (browser-tab icon of the live site, Next auto-serves it)
Source: upload/XR-modified.png. Edits download/xr-code.html in place; safe to re-run.
"""
import base64, io, os, re, shutil, subprocess, sys, tempfile

from PIL import Image

F     = "/home/z/my-project/download/xr-code.html"
SNAP  = "/home/z/my-project/scripts/xr-pre-logo.html"
SRC   = "/home/z/my-project/upload/XR-modified.png"
ICON  = "/home/z/my-project/src/app/icon.png"

def b64_png(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

src_im = Image.open(SRC).convert("RGBA")
b96 = b64_png(src_im.resize((96, 96),  Image.LANCZOS))
b64 = b64_png(src_im.resize((64, 64),  Image.LANCZOS))
src_im.resize((512, 512), Image.LANCZOS).save(ICON, "PNG", optimize=True)

src = open(F, encoding="utf-8").read()

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rex(pat, new, tag, count=1):
    global src
    src, n = re.subn(pat, new, src, count=count)
    if n != count:
        fails.append(f"[{tag}] regex matched {n}x (expected {count})")

# ============ favicon (whatever data-URI is currently there) ============
rex(r'<link rel="icon" type="image/png" href="data:image/png;base64,[A-Za-z0-9+/=]+">',
    f'<link rel="icon" type="image/png" href="data:image/png;base64,{b64}">',
    "favicon")

# ============ topbar logo slots (left + right) ============
rex(r'<div class="logo"><img class="logo-img" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="XR CODE logo"></div>',
    f'<div class="logo"><img class="logo-img" src="data:image/png;base64,{b96}" alt="XR CODE logo"></div>',
    "logo-slots", count=2)

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
for dead in ["logo-img dark-only", "logo-img light-only", "XR logo dark", "XR logo light", ".logo .light-only"]:
    if dead in clean:
        print("SANITY FAILED — leftover:", dead); sys.exit(1)
for keep in ['alt="XR CODE logo"', 'rel="icon"', ".logo-img{width:100%"]:
    if keep not in clean:
        print("SANITY FAILED — missing:", keep); sys.exit(1)
if clean.count('alt="XR CODE logo"') != 2:
    print("SANITY FAILED — expected 2 logo slots"); sys.exit(1)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — current XR logo applied (favicon + 2 topbar slots + site icon.png), bytes:", len(src.encode("utf-8")))
