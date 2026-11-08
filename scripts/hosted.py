#!/usr/bin/env python3
"""hosted.py — move the Z.ai key from the browser to the server database (idempotent):
- New backend contract: GET/POST/DELETE /api/host (key saved once in SQLite via Prisma)
  and POST /api/host/chat (proxy that keeps the key server-side, auto-retries 429).
- Frontend: API_BASE + HOST state + hostCheck() on boot; zaiReady() = server has a key.
- Startup window + sidebar form now POST the key to the server (saved in the database),
  so ONE entry hosts XR CODE for every visitor. localStorage never stores the key again.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-hosted.html"

src = open(F, encoding="utf-8").read()

if "hostCheck" in src:
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

# ---------- 1. state: drop the localStorage key, keep the one-time flag ----------
rep("    zaiKey: null,            // Z.ai API key — the engine that runs the app; never leaves this browser\n"
    "    startupDone: false,      // the \"Select a model\" window shows only once, then never again\n",
    "    startupDone: false,      // the \"Select a model\" window shows once per browser until the key is hosted\n",
    "defaults-zaikey")

rep("    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)\n"
    "    zai: null,               // {model:'glm-4.6'} when a Z.ai key is connected\n",
    "    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)\n",
    "defaults-zai")

rep("  if(S.zai === undefined) S.zai = null;\n",
    "",
    "migrate-zai")

rep("  if(!('zaiKey' in S)) S.zaiKey = null;\n"
    "  if(!('startupDone' in S)) S.startupDone = false;",
    "  if(!('startupDone' in S)) S.startupDone = false;\n"
    "  delete S.zai; delete S.zaiKey;    // keys are hosted on the server — never stored in the browser anymore",
    "migrate-purge")

# ---------- 2. hosted engine block + zaiReady from server truth ----------
rep("/* ---------- auth & engine status ---------- */\n"
    "function zaiReady(){ return !!(S.zai && S.zaiKey); }",

    "/* ---------- hosted engine (the server keeps the key in its database) ---------- */\n"
    "const API_BASE = (function(){\n"
    "  try{\n"
    "    if(window.parent && window.parent !== window){\n"
    "      const o = window.parent.location.origin;\n"
    "      if(/^https?:/i.test(o)) return o;                               // running in the XR CODE site iframe\n"
    "    }\n"
    "  }catch(e){}\n"
    "  return /^https?:/i.test(location.protocol) ? location.origin : '';  // standalone on a server — or file:// (no server)\n"
    "})();\n"
    "const HOST = { checked: false, hosted: false, model: 'glm-4.6' };\n"
    "async function hostCheck(){                          // ask the server once: is a Z.ai key hosted?\n"
    "  if(API_BASE){\n"
    "    try{\n"
    "      const r = await fetch(API_BASE + '/api/host', { cache: 'no-store' });\n"
    "      const d = await r.json();\n"
    "      const was = zaiReady();\n"
    "      HOST.hosted = !!(d && d.hosted);\n"
    "      if(d && d.model) HOST.model = d.model;\n"
    "      if(HOST.hosted && !was) toast('Hosted engine found — GLM-4.6 · Z.ai is live for everyone');\n"
    "    }catch(e){ HOST.hosted = false; }\n"
    "  }\n"
    "  HOST.checked = true;\n"
    "  applyEngineUI();\n"
    "  if(!zaiReady() && !S.startupDone) openStartup();   // one time only — once the key is on the server, no window for anyone\n"
    "}\n"
    "async function hostSaveKey(key){                     // save the key once in the server database\n"
    "  if(!API_BASE) return false;\n"
    "  try{\n"
    "    const r = await fetch(API_BASE + '/api/host', {\n"
    "      method: 'POST',\n"
    "      headers: { 'Content-Type': 'application/json' },\n"
    "      body: JSON.stringify({ apiKey: key })\n"
    "    });\n"
    "    const d = await r.json();\n"
    "    if(d && d.ok){ HOST.hosted = true; HOST.checked = true; return true; }\n"
    "  }catch(e){}\n"
    "  return false;\n"
    "}\n"
    "function applyEngineUI(){                            // paint every engine-dependent UI from server truth\n"
    "  const b = $('#zaiToggle');\n"
    "  if(zaiReady()){ b.textContent = 'Connected'; b.classList.add('ok'); }\n"
    "  else { b.textContent = 'Connect key'; b.classList.remove('ok'); }\n"
    "  renderModels(); renderStatus(); renderZaiLine(); updateSyncUI();\n"
    "  if($('#view-chat').classList.contains('active')) renderChat();\n"
    "  $('#chatInput').placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until Z.ai is hosted...';\n"
    "}\n"
    "\n"
    "/* ---------- auth & engine status ---------- */\n"
    "function zaiReady(){ return !!HOST.hosted; }         // true once a Z.ai key is saved in the server database",
    "hosted-block")

# ---------- 3. sidebar form → save key on the server ----------
rep("function connectEngine(which, e){                    // Z.ai only — the one main engine\n"
    "  e.preventDefault();\n"
    "  const raw = $('#zaiKey').value.trim();\n"
    "  const key = zaiKeyClean(raw);\n"
    "  if(!key){ toast('Paste your Z.ai API key first'); return; }\n"
    "  if(!zaiKeyValid(key)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); return; }\n"
    "  if(raw !== key) toast('Hidden characters removed from the key');\n"
    "  S.zai = { model: 'glm-4.6' };\n"
    "  S.zaiKey = key;                                   // stays in this browser only\n"
    "  $('#zaiKey').value = '';\n"
    "  $('#zaiForm').classList.remove('open');\n"
    "  const btn = $('#zaiToggle');\n"
    "  btn.textContent = 'Connected'; btn.classList.add('ok');\n"
    "  save(); renderModels(); renderChat(); renderStatus(); renderZaiLine();\n"
    "  toast('Z.ai connected — GLM-4.6 now runs every answer');\n"
    "}",
    "function connectEngine(which, e){                    // Z.ai only — saves the key once on the server\n"
    "  e.preventDefault();\n"
    "  const raw = $('#zaiKey').value.trim();\n"
    "  const key = zaiKeyClean(raw);\n"
    "  if(!key){ toast('Paste your Z.ai API key first'); return; }\n"
    "  if(!zaiKeyValid(key)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); return; }\n"
    "  if(raw !== key) toast('Hidden characters removed from the key');\n"
    "  const btn = $('#zaiToggle');\n"
    "  btn.textContent = 'Saving…';\n"
    "  hostSaveKey(key).then(ok => {\n"
    "    $('#zaiKey').value = '';\n"
    "    $('#zaiForm').classList.remove('open');\n"
    "    applyEngineUI();\n"
    "    toast(ok ? 'Z.ai key saved on the server — XR CODE is hosted for everyone'\n"
    "             : 'Could not save the key — XR CODE must run on its own server to host it');\n"
    "  });\n"
    "}",
    "connect-engine")

# ---------- 4. startup window → save key on the server ----------
rep("  const start = () => {\n"
    "    const raw = inp.value.trim();\n"
    "    const k = zaiKeyClean(raw);\n"
    "    if(!k){ toast('Paste the Z.ai API key first — step 1 opens the z.ai key page'); inp.focus(); return; }\n"
    "    if(!zaiKeyValid(k)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); inp.focus(); return; }\n"
    "    if(raw !== k) toast('Hidden characters removed from the key');\n"
    "    S.zai = { model: 'glm-4.6' };\n"
    "    S.zaiKey = k;                                     // stays in this browser only\n"
    "    S.startupDone = true;\n"
    "    save();\n"
    "    const btn = $('#zaiToggle'); btn.textContent = 'Connected'; btn.classList.add('ok');\n"
    "    renderModels(); renderChat(); renderStatus(); renderZaiLine(); updateSyncUI();\n"
    "    closeStartup();\n"
    "    toast('Z.ai connected — GLM-4.6 now runs every answer');\n"
    "  };",
    "  const start = async () => {\n"
    "    const raw = inp.value.trim();\n"
    "    const k = zaiKeyClean(raw);\n"
    "    if(!k){ toast('Paste the Z.ai API key first — step 1 opens the z.ai key page'); inp.focus(); return; }\n"
    "    if(!zaiKeyValid(k)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); inp.focus(); return; }\n"
    "    if(raw !== k) toast('Hidden characters removed from the key');\n"
    "    go.disabled = true; go.textContent = 'Saving the key on the server…';\n"
    "    const ok = await hostSaveKey(k);\n"
    "    go.disabled = false; go.textContent = '2 · Enter key & start XR CODE';\n"
    "    if(!ok){ toast('Could not save the key — open XR CODE on its hosted site and try again'); inp.focus(); return; }\n"
    "    S.startupDone = true;\n"
    "    save();\n"
    "    applyEngineUI();\n"
    "    closeStartup();\n"
    "    toast('Z.ai key hosted — saved once in the database, live for everyone');\n"
    "  };",
    "startup-start")

# ---------- 5. copy updates (one-time hosting story) ----------
rep("<p class=\"st-sub\">XR CODE runs on Z.ai. Connect your API key once &mdash; it stays in this browser only.</p>",
    "<p class=\"st-sub\">XR CODE runs on Z.ai. Enter the API key once &mdash; it is saved in the XR CODE server database and every visitor gets the full engine.</p>",
    "modal-sub")

rep("  if(model.id === 'glm' && S.zaiKey){\n"
    "    zaiChat(c, text, model);\n"
    "  } else {\n"
    "    if(model.id === 'core') toast('Demo mode — connect Z.ai in AI Models to run the real engine');",
    "  if(model.id === 'glm' && zaiReady()){\n"
    "    zaiChat(c, text, model);\n"
    "  } else {\n"
    "    if(model.id === 'core') toast('Demo mode — host the Z.ai key once (AI Models) to run the real engine');",
    "sendmsg-branch")

rep("  if(S.zai) pool.push({ id: 'glm', name: 'GLM-4.6 · Z.ai', heavy: true });",
    "  if(zaiReady()) pool.push({ id: 'glm', name: 'GLM-4.6 · Z.ai', heavy: true });",
    "engine-pool")

rep("inp.placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until you connect Z.ai...';",
    "inp.placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until Z.ai is hosted...';",
    "chat-placeholder")

rep("      : '<span class=\"big\">XR CODE</span>Running on the built-in XR Core demo brain. Connect Z.ai in the sidebar (AI Models) to run the real engine.';",
    "      : '<span class=\"big\">XR CODE</span>Running on the built-in XR Core demo brain. Host the Z.ai key once in the sidebar (AI Models) — it is saved on the server for everyone.';",
    "empty-state")

rep("  return { text: \"Demo mode — XR Core only previews simple things here. Connect Z.ai in AI Models (sidebar) and GLM-4.6 will answer this for real.\" };",
    "  return { text: \"Demo mode — XR Core only previews simple things here. Host the Z.ai key once in AI Models (sidebar): it saves on the server and GLM-4.6 answers for real, for everyone.\" };",
    "genreply-default")

# ---------- 6. zaiChat → go through the hosted server proxy ----------
rep("async function zaiChat(c, text, model){\n"
    "  const waits = [3000, 8000];                         // auto-retry pauses for HTTP 429 (rate limit)\n"
    "  const chip = $('#chatModelChip');\n"
    "  for(let attempt = 0; ; attempt++){\n"
    "    try{\n"
    "      const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {\n"
    "        method: 'POST',\n"
    "        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + zaiKeyClean(S.zaiKey) },\n"
    "        body: JSON.stringify({ model: 'glm-4.6', messages: zaiContext(c), stream: false })\n"
    "      });\n"
    "      if(res.status === 429 && attempt < waits.length){\n"
    "        chip.textContent = 'engine: GLM-4.6 · Z.ai · retrying ' + (attempt + 1) + '/' + waits.length + '…';\n"
    "        toast('Z.ai rate limit (429) — retrying automatically in ' + Math.round(waits[attempt] / 1000) + 's');\n"
    "        await new Promise(r => setTimeout(r, waits[attempt]));\n"
    "        continue;\n"
    "      }\n"
    "      if(!res.ok) throw new Error('HTTP ' + res.status);\n"
    "      const data = await res.json();\n"
    "      const out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;\n"
    "      const t = (out || '').trim();\n"
    "      if(!t) throw new Error('empty reply');\n"
    "      chip.textContent = 'engine: GLM-4.6 · Z.ai · live';\n"
    "      typeReply(c, { text: t }, model, 0);\n"
    "      return;\n"
    "    }catch(err){\n"
    "      chip.textContent = 'engine: GLM-4.6 · Z.ai · live';\n"
    "      let hint;\n"
    "      if(/40[13]/.test(err.message))\n"
    "        hint = 'The key looks invalid or expired — click Connect key in AI Models to update it.';\n"
    "      else if(/429/.test(err.message))\n"
    "        hint = 'Rate limit reached — your key works, but the plan quota is busy. Wait a few seconds and send again.';\n"
    "      else if(/empty reply/.test(err.message))\n"
    "        hint = 'Z.ai returned nothing — send the message once more.';\n"
    "      else if(/ISO-8859-1|headers' property/i.test(err.message))\n"
    "        hint = 'The stored key contains unsupported characters — click Connect key in AI Models and paste it again.';\n"
    "      else\n"
    "        hint = 'Z.ai is unreachable right now — check your connection and try again.';\n"
    "      typeReply(c, { text: 'Z.ai error — ' + err.message + '. ' + hint }, model, 0);\n"
    "      return;\n"
    "    }\n"
    "  }\n"
    "}",
    "async function zaiChat(c, text, model){\n"
    "  const chip = $('#chatModelChip');\n"
    "  chip.textContent = 'engine: GLM-4.6 · Z.ai · live';   // the server auto-retries 429 (rate limit) for us\n"
    "  try{\n"
    "    const res = await fetch(API_BASE + '/api/host/chat', {\n"
    "      method: 'POST',\n"
    "      headers: { 'Content-Type': 'application/json' },\n"
    "      body: JSON.stringify({ messages: zaiContext(c) })\n"
    "    });\n"
    "    const d = await res.json().catch(() => null);\n"
    "    if(!d || !d.ok) throw new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
    "    const t = (d.text || '').trim();\n"
    "    if(!t) throw new Error('empty reply');\n"
    "    typeReply(c, { text: t }, model, 0);\n"
    "    return;\n"
    "  }catch(err){\n"
    "    chip.textContent = 'engine: GLM-4.6 · Z.ai · error';\n"
    "    let hint;\n"
    "    if(/HTTP 40[13]/.test(err.message))\n"
    "      hint = 'The hosted key looks invalid or expired — click Connect key in AI Models and paste a fresh one (it replaces the key saved on the server).';\n"
    "    else if(/HTTP 429/.test(err.message))\n"
    "      hint = 'Rate limit reached — the key works, but the plan quota is busy. The server already retried twice; wait a few seconds and send again.';\n"
    "    else if(/empty reply/.test(err.message))\n"
    "      hint = 'Z.ai returned nothing — send the message once more.';\n"
    "    else\n"
    "      hint = 'XR CODE server or Z.ai is unreachable right now — check your connection and try again.';\n"
    "    typeReply(c, { text: 'Z.ai error — ' + err.message + '. ' + hint }, model, 0);\n"
    "    return;\n"
    "  }\n"
    "}",
    "zai-chat")

# ---------- 7. panels / status lines ----------
rep("      role: zaiReady() ? 'Main engine — runs the whole app: planning, code, review'\n"
    "                       : 'Connect your Z.ai API key (sidebar — AI Models) to run the real engine',\n"
    "      tag: zaiReady() ? 'main' : 'key needed', cls: 'heavy' }",
    "      role: zaiReady() ? 'Main engine — key hosted on this server: planning, code, review'\n"
    "                       : 'One-time setup: paste a Z.ai key (sidebar — AI Models) to host the real engine',\n"
    "      tag: zaiReady() ? 'main' : 'host needed', cls: 'heavy' }",
    "models-panel")

rep("  span.innerHTML = zaiReady()\n"
    "    ? '<b>GLM-4.6 live</b> — Z.ai runs planning, code and review'\n"
    "    : '<b>Demo mode</b> — XR Core answers until a Z.ai key is connected';",
    "  span.innerHTML = zaiReady()\n"
    "    ? '<b>GLM-4.6 hosted</b> — key saved in the server database, live for every visitor'\n"
    "    : '<b>Demo mode</b> — XR Core answers until a Z.ai key is hosted once';",
    "zai-line")

rep("    zaiReady() ? 'Z.ai connected · GLM-4.6'",
    "    zaiReady() ? 'Hosted · GLM-4.6 · Z.ai'",
    "status-line")

# ---------- 8. init tail (order matters: run before the placeholder rep below) ----------
rep("if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }\n"
    "renderZaiLine();\n"
    "if(!zaiReady() && !S.startupDone) openStartup();   // one time only, then saved\n"
    "$('#chatInput').disabled = false;\n"
    "$('#chatInput').placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until you connect Z.ai...';",
    "applyEngineUI();                                    // first paint from local state\n"
    "hostCheck();                                        // ask the server if a key is hosted — opens the one-time window if not\n"
    "$('#chatInput').disabled = false;",
    "init-tail")

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

# ---------- sanity ----------
must_have = ["API_BASE", "hostCheck", "hostSaveKey", "applyEngineUI", "/api/host/chat",
             "saved once in the database", "Hosted · GLM-4.6 · Z.ai", "S.startupDone"]
for good in must_have:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

n_key = src.count("S.zaiKey")
n_zai = src.count("S.zai") - n_key  # 'S.zaiKey' contains 'S.zai'
if n_key != 1 or n_zai != 1:       # exactly the two purge lines in migrate()
    print(f"LEFTOVER STATE REFS: S.zaiKey={n_key} S.zai={n_zai} (expected 1/1 — the migrate purge)"); sys.exit(1)
if "https://api.z.ai" in src:
    print("LEFTOVER: direct browser→Z.ai call still present"); sys.exit(1)
if src.count("/api/host/chat") != 1 or src.count("'/api/host'") != 2:
    print("UNEXPECTED /api/host call count"); sys.exit(1)

print("OK — XR CODE is now hosted: key entered once, saved in the server database:", len(src), "bytes")
