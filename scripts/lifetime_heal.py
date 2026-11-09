#!/usr/bin/env python3
"""lifetime_heal.py — make XR-Code ride out server blips forever:
- netCheck() re-pings every 20s -> the online/offline chip self-corrects, no reload
- chat fetch auto-retries up to 4 attempts (~22s of reconnecting) during a revive
Idempotent. Edits download/xr-code.html in place.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-heal.html"

src = open(F, encoding="utf-8").read()

if "setInterval(netCheck" in src:
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

# ---------- 1. status chip self-recovery ----------
rep("netCheck();                                         // ping the hosted brain once for the status bar",
    "netCheck();                                         // ping the hosted brain once for the status bar\n"
    "setInterval(netCheck, 20000);                       // self-heal the online/offline chip forever",
    "net-loop")

# ---------- 2. chat auto-reconnect (rides out a server revive) ----------
rep("  let d = null, failed = null;\n"
    "  for(let attempt = 0; attempt < 2; attempt++){        // one quiet auto-retry for connection drops\n"
    "    failed = null;\n"
    "    try{\n"
    "      const res = await call();\n"
    "      d = await res.json().catch(() => null);\n"
    "      if(d && d.ok && (d.text || '').trim()) break;\n"
    "      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
    "      break;                                           // server already retried upstream — surface it\n"
    "    }catch(e){\n"
    "      failed = e;\n"
    "      if(attempt === 0){\n"
    "        chip.textContent = 'busy · retrying…';\n"
    "        await new Promise(r => setTimeout(r, 4000));\n"
    "      }\n"
    "    }\n"
    "  }",
    "  let d = null, failed = null;\n"
    "  const waits = [4000, 8000, 10000];                   // ride out a server revive (~22s of auto-reconnect)\n"
    "  for(let attempt = 0; attempt <= waits.length; attempt++){\n"
    "    failed = null;\n"
    "    try{\n"
    "      const res = await call();\n"
    "      d = await res.json().catch(() => null);\n"
    "      if(d && d.ok && (d.text || '').trim()) break;\n"
    "      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
    "      break;                                           // server already retried upstream — surface it\n"
    "    }catch(e){\n"
    "      failed = e;\n"
    "      if(attempt < waits.length){\n"
    "        chip.textContent = 'reconnecting ' + (attempt + 1) + '/' + waits.length + '…';\n"
    "        await new Promise(r => setTimeout(r, waits[attempt]));\n"
    "      }\n"
    "    }\n"
    "  }",
    "chat-retry")

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
    print("JS SYNTAX ERROR:\n" + r.stderr[:1500]); sys.exit(1)

print("OK — lifetime self-heal added:", len(src), "bytes")
