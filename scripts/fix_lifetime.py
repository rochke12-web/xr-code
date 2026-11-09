#!/usr/bin/env python3
"""fix_lifetime.py — make "AI server unreachable" practically impossible:
1. client: 5 attempts with 4/8/15/20s backoff (~47s coverage), 5xx gateway blips retryable
2. client: after an offline bubble, a background healer pings /api/health every 10s;
   when the server is back it auto-flips to online AND auto-resends the failed message
3. server: new GET /api/health (no model call) for cheap pings
4. watchdog: health-checks /api/health instead of /
Edits download/xr-code.html, scripts/watchdog.sh; creates src/app/api/health/route.ts.
"""
import os, shutil, subprocess, sys, tempfile

F     = "/home/z/my-project/download/xr-code.html"
WD    = "/home/z/my-project/scripts/watchdog.sh"
SNAP  = "/home/z/my-project/scripts/xr-pre-lifetime.html"
HEALTH= "/home/z/my-project/src/app/api/health/route.ts"

src = open(F, encoding="utf-8").read()

if "/api/health" in src:
    print("client already patched — nothing to do")
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

# ---------- 1. retry loop: 5 attempts, growing backoff, 5xx retryable ----------
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
    "  const RETRY_WAITS = [4000, 8000, 15000, 20000];      // lifetime net — ~47s of silent self-healing\n"
    "  for(let attempt = 0; attempt <= RETRY_WAITS.length; attempt++){\n"
    "    failed = null;\n"
    "    try{\n"
    "      const res = await call();\n"
    "      if(res.status >= 500 && attempt < RETRY_WAITS.length){   // gateway blips (502/503) retry silently\n"
    "        chip.textContent = 'busy · retrying…';\n"
    "        await new Promise(r => setTimeout(r, RETRY_WAITS[attempt]));\n"
    "        continue;\n"
    "      }\n"
    "      d = await res.json().catch(() => null);\n"
    "      if(d && d.ok && (d.text || '').trim()) break;\n"
    "      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
    "      break;                                           // server already retried upstream — surface it\n"
    "    }catch(e){\n"
    "      failed = e;\n"
    "      if(attempt < RETRY_WAITS.length){\n"
    "        chip.textContent = 'busy · retrying…';\n"
    "        await new Promise(r => setTimeout(r, RETRY_WAITS[attempt]));\n"
    "      }\n"
    "    }\n"
    "  }",
    "retry-loop")

# ---------- 2. background healer after the offline bubble ----------
rep("  el.append(who, body, ch, line);\n"
    "  if(currentChat().id === c.id) box0.append(el);\n"
    "  box0.scrollTop = box0.scrollHeight;\n"
    "}",
    "  el.append(who, body, ch, line);\n"
    "  if(currentChat().id === c.id) box0.append(el);\n"
    "  box0.scrollTop = box0.scrollHeight;\n"
    "  (function heal(){                                   // lifetime auto-recovery: the moment the server\n"
    "    let tries = 0;                                    // breathes again, flip online and resend for real\n"
    "    const iv = setInterval(async () => {\n"
    "      tries++;\n"
    "      try{\n"
    "        const r = await fetch(API_BASE + '/api/health', { cache: 'no-store' });\n"
    "        if(r.ok){\n"
    "          clearInterval(iv);\n"
    "          NET.live = true; renderStatus();\n"
    "          toast('XR Code is back online — sending your message');\n"
    "          const lm = c.messages[c.messages.length - 1];\n"
    "          if(el.isConnected && lm && lm.r === 'u' && lm.t === text){ el.remove(); askBrain(c, text, atts); }\n"
    "          return;\n"
    "        }\n"
    "      }catch(e){}\n"
    "      if(tries >= 90) clearInterval(iv);              // ~15 min of healing, then the Try again button takes over\n"
    "    }, 10000);\n"
    "  })();\n"
    "}",
    "healer")

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

# ---------- 3. /api/health route ----------
os.makedirs(os.path.dirname(HEALTH), exist_ok=True)
open(HEALTH, "w", encoding="utf-8").write(
    "import { NextResponse } from \"next/server\";\n"
    "\n"
    "// lightweight liveness probe — no model call, safe to hit every few seconds\n"
    "export async function GET() {\n"
    "  return NextResponse.json({ ok: true, ts: Date.now() });\n"
    "}\n")

# ---------- 4. watchdog: health endpoint ----------
wd = open(WD, encoding="utf-8").read()
wd = wd.replace("http://localhost:3000/", "http://localhost:3000/api/health")
open(WD, "w", encoding="utf-8").write(wd)

print("OK — lifetime fix applied: 47s retry net + background healer + /api/health + watchdog upgrade")
