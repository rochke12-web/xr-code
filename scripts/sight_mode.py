#!/usr/bin/env python3
"""sight_mode.py — add Sight Mode (photo & video AI) to XR-Code:
- client: eye icon, menu entries (home + chat), MODES map, mode migration
- idempotent: exits cleanly if already patched
Edits download/xr-code.html in place.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-sight.html"

src = open(F, encoding="utf-8").read()

if 'data-mode="sight"' in src:
    print("already patched — nothing to do")
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

# ---------- 1. menu entries (home = 14sp indent + homeInput context; chat = 12sp + chatInput) ----------
rep("<small>sources never shown</small></button>\n"
    "            </div>\n"
    "          </div>\n"
    "          <input id=\"homeInput\"",
    "<small>sources never shown</small></button>\n"
    "              <button type=\"button\" data-mode=\"sight\"><b>Sight Mode</b><small>photo &amp; video AI — imagine it, see it</small></button>\n"
    "            </div>\n"
    "          </div>\n"
    "          <input id=\"homeInput\"",
    "menu-home")

rep("<small>sources never shown</small></button>\n"
    "          </div>\n"
    "        </div>\n"
    "        <input id=\"chatInput\"",
    "<small>sources never shown</small></button>\n"
    "            <button type=\"button\" data-mode=\"sight\"><b>Sight Mode</b><small>photo &amp; video AI — imagine it, see it</small></button>\n"
    "          </div>\n"
    "        </div>\n"
    "        <input id=\"chatInput\"",
    "menu-chat")

# ---------- 2. eye icon symbol (inside a JS string — must be literal backslash-n) ----------
rep('<symbol id="i-qna" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>',
    '<symbol id="i-qna" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>'
    '\\n  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></symbol>',
    "eye-icon")

# ---------- 3. migration + MODES map ----------
rep("  if(S.mode !== 'koder' && S.mode !== 'qna') S.mode = 'koder';   // two modes: koder | qna",
    "  if(S.mode !== 'koder' && S.mode !== 'qna' && S.mode !== 'sight') S.mode = 'koder';   // three modes: koder | qna | sight",
    "migrate")

rep("const MODES = { koder: { n: 'Koder', ic: 'i-cpu' }, qna: { n: 'QnA', ic: 'i-qna' } };",
    "const MODES = { koder: { n: 'Koder', ic: 'i-cpu' }, qna: { n: 'QnA', ic: 'i-qna' }, sight: { n: 'Sight', ic: 'i-eye' } };",
    "modes-map")

if fails:
    print("FAILED ANCHORS:")
    for f in fails: print("  " + f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

n = src.count('data-mode="sight"')
print(f"OK — Sight Mode added ({n} menu entries, eye icon, MODES map, migration):", len(src), "bytes")
