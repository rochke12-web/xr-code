#!/usr/bin/env python3
"""no_rclick.py — block the browser context menu inside XR CODE (idempotent):
right-click anywhere in the app no longer opens the browser's native menu,
so it feels like a real desktop app.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, re, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-rclick.html"

src = open(F, encoding="utf-8").read()

if "contextmenu" in src:
    js0 = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf0:
        tf0.write(js0); tmp0 = tf0.name
    r0 = subprocess.run(["node", "--check", tmp0], capture_output=True, text=True)
    os.unlink(tmp0)
    if r0.returncode != 0:
        print("JS SYNTAX ERROR:\n" + r0.stderr[:2000]); sys.exit(1)
    print("already patched — sanity pass OK")
    sys.exit(0)

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    if n != count:
        fails.append(f"[{tag}] anchor found {n}x (expected {count}): {old[:90]!r}")
        return
    src = src.replace(old, new)

# wire-up section — native-feeling app behaviour: no browser right-click menu
rep('''/* ---------- wire up ---------- */
$('#homeForm').addEventListener('submit', e => {''',
    '''/* ---------- wire up ---------- */
document.addEventListener('contextmenu', e => e.preventDefault());   // right click: no browser menu — native app feel
$('#homeForm').addEventListener('submit', e => {''', "rclick")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

if "contextmenu" not in src:
    print("SANITY FAILED — handler missing"); sys.exit(1)

print("OK — right-click menu blocked, node --check pass, bytes:", len(src.encode("utf-8")))
