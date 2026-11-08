#!/usr/bin/env python3
"""startup_once.py — show the "Select a model" startup window ONLY ONCE (idempotent):
- Skipping it saves S.startupDone = true (persisted in localStorage), so it never
  nags again on later opens.
- Completing the key entry also sets it (extra safety if the key is ever cleared).
- Sidebar "Connect key" / "AI Models" remains the always-available manual path.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-once.html"

src = open(F, encoding="utf-8").read()

if "startupDone" in src:
    print("already patched — nothing to do")
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

# 1. state — new flag
rep("    zaiKey: null,            // Z.ai API key — the engine that runs the app; never leaves this browser",
    "    zaiKey: null,            // Z.ai API key — the engine that runs the app; never leaves this browser\n    startupDone: false,      // the \"Select a model\" window shows only once, then never again",
    "defaults-flag")

rep("  if(!('zaiKey' in S)) S.zaiKey = null;",
    "  if(!('zaiKey' in S)) S.zaiKey = null;\n  if(!('startupDone' in S)) S.startupDone = false;",
    "migrate-flag")

# 2. skip = remember the choice (one time only)
rep("  skip.onclick = () => { closeStartup(); toast('Demo mode — connect Z.ai anytime in AI Models'); };",
    "  skip.onclick = () => { S.startupDone = true; save(); closeStartup();\n    toast('Demo mode — this window will not open again; connect Z.ai anytime in AI Models'); };",
    "skip-once")

# 3. successful start = remember too (safety net)
rep("    S.zai = { model: 'glm-4.6' };\n    S.zaiKey = k;                                     // stays in this browser only\n    save();",
    "    S.zai = { model: 'glm-4.6' };\n    S.zaiKey = k;                                     // stays in this browser only\n    S.startupDone = true;\n    save();",
    "start-once")

# 4. gate — only when never shown before AND no key yet
rep("if(!zaiReady()) openStartup();",
    "if(!zaiReady() && !S.startupDone) openStartup();   // one time only, then saved",
    "init-once")

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

for good in ["startupDone", "!S.startupDone) openStartup()", "this window will not open again"]:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

print("OK — startup window is one-time only:", len(src), "bytes")
