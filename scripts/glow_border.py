#!/usr/bin/env python3
"""glow_border.py — Z.ai-style traveling glow on the home search bar (idempotent):
focusing "What would you like to do with XR CODE?" makes a light sweep run
around the rounded border (top-left -> top-right -> around), plus a soft
ambient glow, instead of the plain border-color change.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, re, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-glow.html"

src = open(F, encoding="utf-8").read()

if "--gs" in src:
    print("already patched — sanity pass OK")
    sys.exit(0)

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

# anchor the ring to the box + animate the sweep angle
rep('''.big-search{
  width:min(660px,100%);display:flex;align-items:center;gap:10px;
  background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:8px 8px 8px 20px;box-shadow:var(--shadow);
  backdrop-filter:blur(12px);transition:border-color .2s;
}
.big-search:focus-within{border-color:var(--accent)}''',
    '''@property --gs{syntax:'<angle>';inherits:false;initial-value:0deg}
.big-search{
  position:relative;
  width:min(660px,100%);display:flex;align-items:center;gap:10px;
  background:var(--panel);border:1px solid var(--line);border-radius:16px;
  padding:8px 8px 8px 20px;box-shadow:var(--shadow);
  backdrop-filter:blur(12px);transition:border-color .2s;
}
.big-search:focus-within{border-color:transparent;box-shadow:var(--shadow),0 0 26px -6px var(--accent-2)}
.big-search::before{                                   /* light sweep running around the border */
  content:"";position:absolute;inset:-1.5px;border-radius:17.5px;padding:1.5px;
  background:conic-gradient(from var(--gs),
    transparent 0turn 0.72turn,
    var(--accent) 0.86turn,
    #ffffff 0.93turn,
    var(--accent) 0.97turn,
    transparent 1turn);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  opacity:0;transition:opacity .25s;
  animation:gs-spin 2.4s linear infinite;
  pointer-events:none;
}
.big-search:focus-within::before{opacity:1}
@keyframes gs-spin{to{--gs:360deg}}''', "glow-css")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
for keep in ["--gs", "gs-spin", "conic-gradient", "mask-composite:exclude"]:
    if keep not in clean:
        print("SANITY FAILED — missing:", keep); sys.exit(1)
js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — traveling border glow on the home search bar, bytes:", len(src.encode("utf-8")))
