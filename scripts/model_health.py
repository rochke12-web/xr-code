#!/usr/bin/env python3
# Health-check every model in the XR Code selector via the app's real /api/chat
import json, time, urllib.request

MODELS = ["prime-v1-flash", "prime-v1-vision", "glm-5.3", "glm-5.2", "glm-5.3-flash"]
URL = "http://localhost:3000/api/chat"

def ask(model, prompt, timeout=60):
    body = json.dumps({
        "messages": [{"role": "user", "content": prompt}],
        "model": model,
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            d = json.loads(r.read())
        dt = time.time() - t0
        return d.get("ok"), d.get("engine"), (d.get("text") or "").strip(), dt, None
    except Exception as e:
        return False, None, "", time.time() - t0, repr(e)[:120]

print(f"{'model':<18} {'ok':<4} {'engine':<18} {'sec':>6}  reply / error")
print("-" * 78)
for m in MODELS:
    ok, eng, txt, dt, err = ask(m, "Reply with exactly this one word and nothing else: " + m.upper() + "-OK")
    status = "PASS" if ok and txt else "FAIL"
    print(f"{m:<18} {status:<4} {str(eng):<18} {dt:>6.1f}  {(txt or err)[:60]}")

print()
print("Identity spot-check on two models (must say XR Code, never Prime/Glm):")
for m in ["prime-v1-flash", "glm-5.3"]:
    ok, eng, txt, dt, err = ask(m, "Who are you? Answer in one short sentence.", timeout=60)
    print(f"  [{m}] {(txt or err)[:140]}")
