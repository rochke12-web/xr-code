#!/usr/bin/env python3
"""heal_chip.py — complete the lifetime self-heal: status chip auto-recovery.
The chat retry loop (RETRY_WAITS, 5 attempts / ~47s) already exists — only
netCheck() still runs once at boot, so the online/offline chip never recovers
without a reload. Add a 20s re-ping. Idempotent.
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

old = "netCheck();                                         // ping the hosted brain once for the status bar"
new = ("netCheck();                                         // ping the hosted brain once for the status bar\n"
       "setInterval(netCheck, 20000);                       // chip self-heals: offline flips back to online on its own")

n = src.count(old)
if n != 1:
    print(f"[net-loop] anchor found {n}x (expected 1)"); sys.exit(1)
src = src.replace(old, new)

open(F, "w", encoding="utf-8").write(src)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:1500]); sys.exit(1)

print("OK — chip self-heal interval added:", len(src), "bytes")
