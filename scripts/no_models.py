#!/usr/bin/env python3
"""no_models.py — remove ALL api-key / model-option UI from XR CODE (idempotent):
- No AI Models box, no startup "Select a model" window, no key forms, no routing,
  no engine panel, no Z.ai/GLM copy anywhere. The app just runs on the hosted
  server brain (POST /api/chat via the platform SDK — zero setup for visitors).
- Boot pings GET /api/chat once for the status bar; local file:// preview falls
  back to the built-in demo brain.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-nomodels.html"

src = open(F, encoding="utf-8").read()

if "netCheck" in src:
    # already patched — still run the full sanity pass before exiting
    import re as _re0
    _clean = _re0.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
    _purge = _clean.count("delete S.zai; delete S.zaiKey;")
    ok = (_clean.count("Z.ai") == 0 and _clean.count("GLM") == 0 and _clean.count("AI Models") == 0
          and _clean.count("AI key") == 0 and "/api/host" not in _clean
          and _clean.count("zai") == _purge * 2 and _purge == 1
          and "netCheck" in src and "/api/chat" in src)
    js0 = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf0:
        tf0.write(js0); tmp0 = tf0.name
    r0 = subprocess.run(["node", "--check", tmp0], capture_output=True, text=True)
    os.unlink(tmp0)
    if r0.returncode != 0:
        print("JS SYNTAX ERROR:\n" + r0.stderr[:2000]); sys.exit(1)
    if not ok:
        print("SANITY FAILED on already-patched file"); sys.exit(1)
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

# ============ HTML ============

# 1. hero pill — no Z.ai / model name
rep('<span class="hero-pill"><span class="dot"></span> AI online &mdash; runs on Z.ai &middot; GLM-4.6</span>',
    '<span class="hero-pill"><span class="dot"></span> AI hosted &mdash; ready for everyone, zero setup</span>',
    "hero-pill")

# 2. chat chip initial
rep('<span class="chip" id="chatModelChip">model: auto</span>',
    '<span class="chip" id="chatModelChip">engine: live</span>',
    "chip-init")

# 3. settings — remove the whole AI Engine panel (routing, models, tokens saved)
rep('          <div class="panel">\n'
    '            <h3><svg class="ic big"><use href="#i-cpu"/></svg> AI Engine</h3>\n'
    '            <div class="switch-row">\n'
    '              <span class="lbl">Smart routing<small>Z.ai GLM-4.6 does the heavy work &mdash; XR Core covers answers when no key is connected</small></span>\n'
    '              <label class="switch"><input type="checkbox" class="routingToggle" checked><span class="tr"></span></label>\n'
    '            </div>\n'
    '            <div id="modelsPanel"></div>\n'
    '            <div class="token-stat">\n'
    '              <span class="num" id="tokSaved">0</span>\n'
    '              <span class="cap">tokens saved by routing (est.)</span>\n'
    '            </div>\n'
    '          </div>\n'
    '\n',
    "",
    "settings-engine-panel")

# 4. sidebar — remove the whole AI Models box (key form + status lines)
rep('    <div class="login-box" id="modelBox">\n'
    '      <h3>AI Models</h3>\n'
    '      <div class="prov-head">\n'
    '        <span class="pn">Z.ai <em class="prov-tag">main ai</em></span>\n'
    '        <button class="prov-btn" id="zaiToggle" type="button">Connect key</button>\n'
    '      </div>\n'
    '      <form class="api-form" id="zaiForm">\n'
    '        <input id="zaiKey" type="password" autocomplete="off" placeholder="sk-... &mdash; your Z.ai API key (api.z.ai)">\n'
    '        <button class="api-connect" type="submit">Connect Z.ai</button>\n'
    '      </form>\n'
    '      <div class="sync-line" id="zaiLine"></div>\n'
    '      <div class="sync-line" id="syncLine"></div>\n'
    '    </div>\n'
    '  </aside>',
    '  </aside>',
    "sidebar-modelbox")

# 5. remove the startup "Select a model" window
rep('<!-- ============ STARTUP — SELECT A MODEL ============ -->\n'
    '<div class="startup-back" id="startModal">\n'
    '  <div class="startup" role="dialog" aria-modal="true" aria-label="Select a model to start">\n'
    '    <div class="st-brand">XR CODE</div>\n'
    '    <h2>Select a model to start</h2>\n'
    '    <p class="st-sub">XR CODE runs on Z.ai. Enter the API key once &mdash; it is saved in the XR CODE server database and every visitor gets the full engine.</p>\n'
    '    <div id="stBody"></div>\n'
    '  </div>\n'
    '</div>\n',
    "",
    "startup-modal-html")

# ============ JS: state ============

# 6. defaults — drop startupDone / gemini / local / routing / models / tokensSaved
rep("function defaults(){\n"
    "  return {\n"
    "    theme: 'dark',\n"
    "    user: null,              // optional Google/Discord link — only marks chats as synced\n"
    "    startupDone: false,      // the \"Select a model\" window shows once per browser until the key is hosted\n"
    "    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)\n"
    "    local: { lfm: true, parallel: true, pickle: true, kimi: true },  // free local models (Step 3)\n"
    "    routing: true,           // smart model routing\n"
    "    models: { flash: true, pro: true, glm: true },\n"
    "    tokensSaved: 0,\n"
    "    chats: seedChats(),\n"
    "    active: null,\n"
    "    lastSync: null\n"
    "  };\n"
    "}",
    "function defaults(){\n"
    "  return {\n"
    "    theme: 'dark',\n"
    "    user: null,              // optional Google/Discord link — only marks chats as synced\n"
    "    chats: seedChats(),\n"
    "    active: null,\n"
    "    lastSync: null\n"
    "  };\n"
    "}",
    "defaults")

# 7. migrate — purge every legacy flag
rep("(function migrate(){\n"
    "  if(!('flash' in (S.models || {}))) S.models = { flash: true, pro: true, glm: true };\n"
    "  if(S.gemini === undefined) S.gemini = null;\n"
    "  if(!S.local) S.local = { lfm: true, parallel: true, pickle: true, kimi: true };\n"
    "  if(!('startupDone' in S)) S.startupDone = false;\n"
    "  delete S.zai; delete S.zaiKey;    // keys are hosted on the server — never stored in the browser anymore\n"
    "  if(S.user && S.user.provider === 'api') S.user = null;\n"
    "  delete S.api;\n"
    "})();",
    "(function migrate(){\n"
    "  delete S.zai; delete S.zaiKey;                            // API-key era removed\n"
    "  delete S.models; delete S.routing; delete S.tokensSaved;  // model options removed\n"
    "  delete S.startupDone; delete S.gemini; delete S.local;    // leftovers from old versions\n"
    "  if(S.user && S.user.provider === 'api') S.user = null;\n"
    "  delete S.api;\n"
    "})();",
    "migrate")

# 8. hosted block → NET probe (keep API_BASE, drop keys/keys-UI/gating)
rep("/* ---------- hosted engine (the server keeps the key in its database) ---------- */\n"
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

    "/* ---------- hosted AI (one brain on the XR CODE server — no keys, no model picking) ---------- */\n"
    "const API_BASE = (function(){\n"
    "  try{\n"
    "    if(window.parent && window.parent !== window){\n"
    "      const o = window.parent.location.origin;\n"
    "      if(/^https?:/i.test(o)) return o;                               // running in the XR CODE site iframe\n"
    "    }\n"
    "  }catch(e){}\n"
    "  return /^https?:/i.test(location.protocol) ? location.origin : '';  // standalone on a server — or file:// (no server)\n"
    "})();\n"
    "const NET = { checked: false, live: false };\n"
    "async function netCheck(){                           // ping the hosted brain once for the status bar\n"
    "  if(API_BASE){\n"
    "    try{\n"
    "      const r = await fetch(API_BASE + '/api/chat', { cache: 'no-store' });\n"
    "      const d = await r.json();\n"
    "      NET.live = !!(d && d.ok);\n"
    "    }catch(e){ NET.live = false; }\n"
    "  }\n"
    "  NET.checked = true;\n"
    "  renderStatus();\n"
    "  renderAccounts();\n"
    "}\n"
    "\n"
    "/* ---------- auth & engine status ---------- */",
    "hosted-to-net")

# 9. remove connectEngine (key save)
rep("function connectEngine(which, e){                    // Z.ai only — saves the key once on the server\n"
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
    "}\n",
    "",
    "connect-engine")

# 10. remove key sanitizing helpers
rep("/* ---------- key sanitizing (Authorization headers must be plain ASCII) ---------- */\n"
    "function zaiKeyClean(raw){\n"
    "  return String(raw || '')\n"
    "    .replace(/\\s+/g, '')            // spaces, tabs, NBSP…\n"
    "    .replace(/[^\\x21-\\x7E]/g, ''); // zero-width chars, BOM, curly quotes, CJK…\n"
    "}\n"
    "function zaiKeyValid(k){\n"
    "  return /^[A-Za-z0-9._:~\\/+=-]{10,}$/.test(k);\n"
    "}\n"
    "\n",
    "",
    "key-sanitize")

# 11. remove the whole startup section
rep("/* ---------- startup — select a model to start ---------- */\n"
    "const ZAI_KEY_PAGE = 'https://z.ai/manage-apikey/apikey-list';\n"
    "function openStartup(){ stStep1(); $('#startModal').classList.add('open'); }\n"
    "function closeStartup(){ $('#startModal').classList.remove('open'); }\n",
    "",
    "startup-fns-1")

rep("function stStep1(){                                   // step 1 — pick the model (Z.ai only)\n"
    "  const b = $('#stBody'); b.innerHTML = '';\n"
    "  const card = document.createElement('button'); card.className = 'st-card'; card.type = 'button';\n"
    "  card.innerHTML = '<span class=\"st-name\">Z.ai <em>GLM-4.6 &mdash; runs the whole app</em></span>' +\n"
    "                   '<span class=\"st-tag\">main ai</span><span class=\"st-go\">Start &rarr;</span>';\n"
    "  card.onclick = stStep2;\n"
    "  const skip = document.createElement('button'); skip.className = 'st-skip'; skip.type = 'button';\n"
    "  skip.textContent = 'Skip for now — try the XR Core demo';\n"
    "  skip.onclick = () => { S.startupDone = true; save(); closeStartup();\n"
    "    toast('Demo mode — this window will not open again; connect Z.ai anytime in AI Models'); };\n"
    "  b.append(card, skip);\n"
    "}\n"
    "function stStep2(){                                   // step 2 — key page redirect + enter key\n"
    "  const b = $('#stBody'); b.innerHTML = '';\n"
    "  const o = document.createElement('a'); o.className = 'st-open'; o.target = '_blank'; o.rel = 'noopener';\n"
    "  o.href = ZAI_KEY_PAGE;\n"
    "  o.innerHTML = '<b>1 &middot; Get your API key</b><span>Opens z.ai &mdash; API Keys &rarr; create a new key and copy it</span>';\n"
    "  const inp = document.createElement('input'); inp.className = 'st-input'; inp.type = 'password';\n"
    "  inp.id = 'stKey'; inp.autocomplete = 'off';\n"
    "  inp.placeholder = 'sk-... — paste your Z.ai API key here';\n"
    "  const go = document.createElement('button'); go.className = 'st-go-btn'; go.type = 'button';\n"
    "  go.textContent = '2 · Enter key & start XR CODE';\n"
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
    "  };\n"
    "  go.onclick = start;\n"
    "  inp.addEventListener('keydown', e => { if(e.key === 'Enter') start(); });\n"
    "  const back = document.createElement('button'); back.className = 'st-skip'; back.type = 'button';\n"
    "  back.textContent = 'Back';\n"
    "  back.onclick = stStep1;\n"
    "  b.append(o, inp, go, back);\n"
    "  setTimeout(() => inp.focus(), 60);\n"
    "}\n"
    "\n",
    "",
    "startup-fns-2")

# ============ JS: chat pipeline ============

# 12. renderChat — single state
rep("function renderChat(){\n"
    "  const c = currentChat();\n"
    "  $('#chatTitle').textContent = c.title;\n"
    "  const inp = $('#chatInput');\n"
    "  inp.disabled = false;\n"
    "  inp.placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until Z.ai is hosted...';\n"
    "  const box = $('#msgs'); box.innerHTML = '';\n"
    "  if(!c.messages.length){\n"
    "    const e = document.createElement('div');\n"
    "    e.className = 'empty-state';\n"
    "    e.innerHTML = zaiReady()\n"
    "      ? '<span class=\"big\">XR CODE</span>Ask anything — GLM-4.6 via Z.ai runs every answer: it plans, codes and reviews on its own.'\n"
    "      : '<span class=\"big\">XR CODE</span>Running on the built-in XR Core demo brain. Host the Z.ai key once in the sidebar (AI Models) — it is saved on the server for everyone.';\n"
    "    box.append(e); return;\n"
    "  }\n"
    "  c.messages.forEach(m => box.append(msgEl(m, c)));\n"
    "  box.scrollTop = box.scrollHeight;\n"
    "}",
    "function renderChat(){\n"
    "  const c = currentChat();\n"
    "  $('#chatTitle').textContent = c.title;\n"
    "  const inp = $('#chatInput');\n"
    "  inp.disabled = false;\n"
    "  inp.placeholder = 'Message XR CODE...';\n"
    "  const box = $('#msgs'); box.innerHTML = '';\n"
    "  if(!c.messages.length){\n"
    "    const e = document.createElement('div');\n"
    "    e.className = 'empty-state';\n"
    "    e.innerHTML = '<span class=\"big\">XR CODE</span>Ask anything — the hosted AI brain plans, codes, debugs and explains on its own.';\n"
    "    box.append(e); return;\n"
    "  }\n"
    "  c.messages.forEach(m => box.append(msgEl(m, c)));\n"
    "  box.scrollTop = box.scrollHeight;\n"
    "}",
    "render-chat")

# 13. msgEl chip — normalize old message labels too
rep("  if(m.r === 'a' && m.m){\n"
    "    const chip = document.createElement('span'); chip.className = 'chip';\n"
    "    chip.textContent = 'via ' + m.m + (m.saved ? ' · routing saved ~' + m.saved + ' tokens' : '');\n"
    "    w.append(chip);\n"
    "  }",
    "  if(m.r === 'a' && m.m){\n"
    "    const chip = document.createElement('span'); chip.className = 'chip';\n"
    "    chip.textContent = 'engine: ' + (m.m === 'XR Core' || m.m === 'demo' ? 'demo' : 'live');\n"
    "    w.append(chip);\n"
    "  }",
    "msgel-chip")

# 14. remove engine pool / routing / estSaved
rep("/* ---------- engine (Z.ai only) ---------- */\n"
    "function enginePool(){\n"
    "  const pool = [];\n"
    "  if(zaiReady()) pool.push({ id: 'glm', name: 'GLM-4.6 · Z.ai', heavy: true });\n"
    "  return pool;\n"
    "}\n"
    "function routeModel(text){\n"
    "  const pool = enginePool();\n"
    "  if(!pool.length) return { id: 'core', name: 'XR Core', heavy: false, free: false };  // built-in demo brain\n"
    "  return pool[0];\n"
    "}\n"
    "function estSaved(text, m){\n"
    "  return 0;                                                                // single live engine — nothing to arbitrage\n"
    "}\n"
    "\n",
    "",
    "engine-pool")

# 15. genReply default copy
rep('  return { text: "Demo mode — XR Core only previews simple things here. Host the Z.ai key once in AI Models (sidebar): it saves on the server and GLM-4.6 answers for real, for everyone." };',
    '  return { text: "Local preview — XR CODE answers for real when it runs on its hosted site." };',
    "genreply")

# 16. sendMsg — always the hosted brain
rep("  const model = routeModel(text);\n"
    "  $('#chatModelChip').textContent = 'engine: ' + model.name + (model.id === 'glm' ? ' · live' : ' · demo');\n"
    "  if(model.id === 'glm' && zaiReady()){\n"
    "    zaiChat(c, text, model);\n"
    "  } else {\n"
    "    if(model.id === 'core') toast('Demo mode — host the Z.ai key once (AI Models) to run the real engine');\n"
    "    typeReply(c, genReply(text), model, 0);\n"
    "  }\n"
    "}",
    "  askBrain(c, text);\n"
    "}",
    "sendmsg")

# 17. typeReply — no model objects, no routing chip
rep("function typeReply(c, reply, model, saved){",
    "function typeReply(c, reply, live){",
    "typereply-sig")

rep("  chip.textContent = 'via ' + model.name + (model.id === 'glm' ? ' · live' : (S.routing ? ' · auto-routed' : ''));",
    "  chip.textContent = 'engine: ' + (live ? 'live' : 'demo');",
    "typereply-chip")

rep("      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: model.name, saved: saved });\n"
    "      save(); return;",
    "      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });\n"
    "      save(); return;",
    "typereply-store-1")

rep("      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: model.name, saved: saved });\n"
    "      c.ts = now();",
    "      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });\n"
    "      c.ts = now();",
    "typereply-store-2")

# 17.5 rename legacy zaiContext + section comment
rep("/* ---------- Z.ai live engine (GLM-4.6, OpenAI-compatible) ---------- */\n"
    "function zaiContext(c){\n"
    "  return c.messages.slice(-12).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));\n"
    "}",
    "/* ---------- hosted brain ---------- */\n"
    "function brainContext(c){\n"
    "  return c.messages.slice(-12).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));\n"
    "}",
    "brain-context")

# 18. askBrain — POST /api/chat (hosted brain), demo fallback on file://
rep("async function zaiChat(c, text, model){\n"
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
    "async function askBrain(c, text){\n"
    "  const chip = $('#chatModelChip');\n"
    "  chip.textContent = 'engine: live · thinking…';\n"
    "  try{\n"
    "    const res = await fetch(API_BASE + '/api/chat', {\n"
    "      method: 'POST',\n"
    "      headers: { 'Content-Type': 'application/json' },\n"
    "      body: JSON.stringify({ messages: brainContext(c) })\n"
    "    });\n"
    "    const d = await res.json().catch(() => null);\n"
    "    if(!d || !d.ok) throw new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
    "    const t = (d.text || '').trim();\n"
    "    if(!t) throw new Error('empty reply');\n"
    "    chip.textContent = 'engine: live';\n"
    "    NET.live = true; renderStatus();\n"
    "    typeReply(c, { text: t }, true);\n"
    "  }catch(err){\n"
    "    chip.textContent = 'engine: demo';\n"
    "    if(!API_BASE){\n"
    "      typeReply(c, genReply(text), false);               // local file preview — built-in demo brain\n"
    "      toast('Local preview — the hosted brain answers on the live site');\n"
    "    } else {\n"
    "      typeReply(c, { text: 'The AI server is unreachable right now — check your connection and try again in a moment.' }, false);\n"
    "    }\n"
    "  }\n"
    "}",
    "ask-brain")

# ============ JS: panels & status ============

# 19. remove renderModels
rep("/* ---------- AI engine panel (settings) ---------- */\n"
    "function renderModels(){\n"
    "  const p = $('#modelsPanel'); if(!p) return; p.innerHTML = '';\n"
    "  const rows = [\n"
    "    { name: 'GLM-4.6 · Z.ai',\n"
    "      role: zaiReady() ? 'Main engine — key hosted on this server: planning, code, review'\n"
    "                       : 'One-time setup: paste a Z.ai key (sidebar — AI Models) to host the real engine',\n"
    "      tag: zaiReady() ? 'main' : 'host needed', cls: 'heavy' }\n"
    "  ];\n"
    "  rows.forEach(r => {\n"
    "    const row = document.createElement('div'); row.className = 'model-row';\n"
    "    const info = document.createElement('div'); info.className = 'mi';\n"
    "    const n = document.createElement('div'); n.className = 'mn'; n.textContent = r.name;\n"
    "    const rr = document.createElement('div'); rr.className = 'mr'; rr.textContent = r.role;\n"
    "    info.append(n, rr);\n"
    "    const t = document.createElement('span'); t.className = 'tagm ' + r.cls; t.textContent = r.tag;\n"
    "    row.append(info, t);\n"
    "    p.append(row);\n"
    "  });\n"
    "}\n",
    "",
    "render-models")

# 20. accounts engine text
rep("      ' · engine: ' + (zaiReady() ? 'GLM-4.6 (Z.ai)' : 'XR Core (demo)');",
    "      ' · engine: ' + (NET.live ? 'XR CODE AI (live)' : 'XR Core (demo)');",
    "accounts-engine")

# 21. updateSyncUI — sidebar line removed → null guard
rep("function updateSyncUI(){\n"
    "  const el = $('#syncLine');\n"
    "  el.innerHTML = '';",
    "function updateSyncUI(){\n"
    "  const el = $('#syncLine');\n"
    "  if(!el) return;\n"
    "  el.innerHTML = '';",
    "update-sync-guard")

# 22. remove renderZaiLine
rep("function renderZaiLine(){\n"
    "  const el = $('#zaiLine'); if(!el) return;\n"
    "  el.innerHTML = '';\n"
    "  const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');\n"
    "  ic.setAttribute('class', 'ic small');\n"
    "  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');\n"
    "  use.setAttribute('href', '#i-cpu'); ic.append(use);\n"
    "  const span = document.createElement('span');\n"
    "  span.innerHTML = zaiReady()\n"
    "    ? '<b>GLM-4.6 hosted</b> — key saved in the server database, live for every visitor'\n"
    "    : '<b>Demo mode</b> — XR Core answers until a Z.ai key is hosted once';\n"
    "  el.append(ic, span);\n"
    "}\n",
    "",
    "render-zailine")

# 23. renderStatus — hosted brain truth
rep("function renderStatus(){\n"
    "  const el = $('#stConn');\n"
    "  el.innerHTML = '';\n"
    "  const on = zaiReady() || S.user;\n"
    "  const d = document.createElement('span'); d.className = 'dot' + (on ? ' on' : '');\n"
    "  el.append(d, document.createTextNode(\n"
    "    zaiReady() ? 'Hosted · GLM-4.6 · Z.ai'\n"
    "    : S.user   ? 'Linked · ' + S.user.name + ' · demo engine'\n"
    "               : 'Z.ai not connected — demo mode'));\n"
    "}",
    "function renderStatus(){\n"
    "  const el = $('#stConn');\n"
    "  el.innerHTML = '';\n"
    "  const d = document.createElement('span'); d.className = 'dot' + (NET.live ? ' on' : '');\n"
    "  const txt = !NET.checked ? 'AI brain connecting…'\n"
    "            : NET.live     ? 'AI online — hosted brain'\n"
    "                           : 'AI offline — demo brain';\n"
    "  el.append(d, document.createTextNode(txt));\n"
    "}",
    "render-status")

# 24. clearAll — drop models/tokens lines
rep("function clearAll(){\n"
    "  localStorage.removeItem(LSKEY);\n"
    "  S = defaults(); applyTheme(); renderChats(); renderChat(); renderAccounts(); renderModels();\n"
    "  $('#tokSaved').textContent = '0';\n"
    "  $$('.routingToggle').forEach(t => t.checked = S.routing);\n"
    "  toast('All data cleared');\n"
    "}",
    "function clearAll(){\n"
    "  localStorage.removeItem(LSKEY);\n"
    "  S = defaults(); applyTheme(); renderChats(); renderChat(); renderAccounts();\n"
    "  toast('All data cleared');\n"
    "}",
    "clear-all")

# 25. wiring — remove setRouting + zai toggles + routing listeners
rep("/* ---------- wire up ---------- */\n"
    "function setRouting(v){\n"
    "  S.routing = v; save();\n"
    "  $$('.routingToggle').forEach(t => t.checked = v);\n"
    "  toast(v ? 'Smart routing on — tokens saved' : 'Smart routing off — single model');\n"
    "}\n",
    "/* ---------- wire up ---------- */",
    "set-routing")

rep("$('#chatSearch').addEventListener('input', e => renderChats(e.target.value));\n"
    "$('#zaiToggle').onclick = () => { $('#zaiForm').classList.toggle('open'); $('#zaiKey').focus(); };\n"
    "$('#zaiForm').addEventListener('submit', e => connectEngine('zai', e));\n"
    "\n"
    "$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));\n"
    "\n",
    "$('#chatSearch').addEventListener('input', e => renderChats(e.target.value));\n"
    "\n",
    "wiring-toggles")

# 26. showView — no models panel refresh
rep("  if(name === 'chat') renderChat();\n  if(name === 'settings') renderModels();",
    "  if(name === 'chat') renderChat();",
    "showview")

# 27. init tail
rep("/* ---------- init ---------- */\n"
    "applyTheme();\n"
    "renderChats();\n"
    "renderAccounts();\n"
    "renderModels();\n"
    "updateSyncUI();\n"
    "renderStatus();\n"
    "$('#tokSaved').textContent = S.tokensSaved.toLocaleString();\n"
    "$$('.routingToggle').forEach(t => t.checked = S.routing);\n"
    "applyEngineUI();                                    // first paint from local state\n"
    "hostCheck();                                        // ask the server if a key is hosted — opens the one-time window if not\n"
    "$('#chatInput').disabled = false;",
    "/* ---------- init ---------- */\n"
    "applyTheme();\n"
    "renderChats();\n"
    "renderAccounts();\n"
    "updateSyncUI();\n"
    "renderStatus();\n"
    "netCheck();                                         // ping the hosted brain once for the status bar\n"
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

# ---------- sanity: zero model/api leftovers (base64 image data excluded) ----------
import re as _re
clean = _re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
for bad in ["Z.ai", "GLM", "glm", "ZAI", "API key", "api-key", "apiKey",
            "modelBox", "startModal", "startupDone", "routingToggle", "modelsPanel",
            "tokSaved", "hostCheck", "hostSaveKey", "applyEngineUI", "connectEngine",
            "enginePool", "routeModel", "estSaved", "setRouting", "/api/host",
            "Smart routing", "tokens saved", "Select a model", "AI Models"]:
    n = clean.count(bad)
    if n:
        print(f"LEFTOVER {n}x: {bad}"); sys.exit(1)

purge = clean.count("delete S.zai; delete S.zaiKey;")   # the single migrate purge line stays on purpose
if clean.count("zai") != purge * 2 or purge != 1:
    print(f"UNEXPECTED zai refs: {clean.count('zai')} (purge lines: {purge})"); sys.exit(1)

for good in ["netCheck", "NET.live", "/api/chat", "engine: live", "hosted AI brain",
             "AI online — hosted brain", "brainContext", "askBrain"]:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

print("OK — XR CODE runs on the hosted brain only: no API, no model options:", len(src), "bytes")
