#!/usr/bin/env python3
"""search_logo.py — put the dark XR wordmark into the home search bar (idempotent):
replaces the current .bs-logo image with upload/pasted_image_1794125450685.png
(wide 92x47 wordmark) and adapts the badge CSS to its aspect ratio.
Topbar logos stay untouched. Edits download/xr-code.html in place; safe to re-run.
"""
import base64, io, os, re, shutil, subprocess, sys, tempfile

from PIL import Image

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-searchlogo.html"
SRC  = "/home/z/my-project/upload/pasted_image_1794125450685.png"

def b64_png(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

im = Image.open(SRC).convert("RGBA")
# native 92x47 -> 128x~65 for retina sharpness (small upscale only)
w = 128
h = round(im.height * w / im.width)
bWord = b64_png(im.resize((w, h), Image.LANCZOS))

src = open(F, encoding="utf-8").read()

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    if n != count:
        fails.append(f"[{tag}] anchor found {n}x (expected {count}): {old[:80]!r}")
        return
    src = src.replace(old, new)

# swap the search-bar badge image (whatever data-URI it currently holds)
src, n = re.subn(
    r'(<img class="bs-logo" src="data:image/png;base64,)[A-Za-z0-9+/=]+(" alt="XR logo" draggable="false">)',
    rf'\g<1>{bWord}\g<2>', src)
if n != 1:
    fails.append(f"[bs-logo] regex matched {n}x (expected 1)")

# badge CSS: wide chip, keep aspect ratio
rep('.big-search .bs-logo{width:30px;height:30px;border-radius:9px;object-fit:cover;display:block;flex:none;box-shadow:0 0 0 1px var(--line)}',
    '.big-search .bs-logo{height:30px;width:auto;border-radius:8px;object-fit:contain;display:block;flex:none;box-shadow:0 0 0 1px var(--line)}',
    "bs-logo-css")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
if clean.count("bs-logo") != 2:
    print("SANITY FAILED — bs-logo count wrong"); sys.exit(1)
if "width:auto;border-radius:8px" not in clean:
    print("SANITY FAILED — CSS not updated"); sys.exit(1)
js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — XR wordmark in search bar, bytes:", len(src.encode("utf-8")))
