#!/usr/bin/env python3
"""zai_only.py — XR CODE refactor (idempotent):
1. Sidebar bottom: replace forced "Log in" box with a compact "AI Models" section (Z.ai ONLY).
2. Remove Google gate everywhere — chat is always usable (XR Core demo brain without a key).
3. Google/Discord become an OPTIONAL link inside Settings > Account (chat sync only).
4. Real Z.ai engine: stores key locally, calls api.z.ai GLM-4.6 (OpenAI-compatible),
   falls back to XR Core demo brain on failure.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F   = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-zai.html"

src = open(F, encoding="utf-8").read()

if "#modelBox" in src and "zaiChat" in src:
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

# ============================================================
# 1. STATIC HTML — hero pill
# ============================================================
rep('<span class="hero-pill"><span class="dot"></span> AI online &mdash; Google login &middot; Gemini + Z.ai engines</span>',
    '<span class="hero-pill"><span class="dot"></span> AI online &mdash; runs on Z.ai &middot; GLM-4.6</span>',
    "hero-pill")

# ============================================================
# 2. STATIC HTML — settings: routing label + note
# ============================================================
rep('<span class="lbl">Smart model routing<small>XR CODE switches between Gemini and Z.ai automatically to save tokens</small></span>',
    '<span class="lbl">Smart routing<small>Z.ai GLM-4.6 does the heavy work &mdash; XR Core covers answers when no key is connected</small></span>',
    "routing-lbl")

rep('<p class="note" style="margin-top:12px">Chats are stored in this browser and marked as saved to your connected account (Google or Discord). With a real backend, this same view syncs them to that account.</p>',
    '<p class="note" style="margin-top:12px">Chats are stored in this browser. Linking Google or Discord is optional &mdash; it only marks your chats as saved to that account. The AI itself runs on Z.ai once a key is connected.</p>',
    "settings-note")

# ============================================================
# 3. SIDEBAR — replace the whole "Log in" box with "AI Models" (Z.ai only)
# ============================================================
OLD_BOX = '''    <div class="login-box" id="loginBox">
      <h3>Log in</h3>
      <span class="step-lbl">Step 1 &middot; Account &mdash; required</span>
      <div class="login-stack" id="authButtons">
        <button class="auth-btn" id="loginGoogle" type="button">
          <svg class="ic"><use href="#i-g"/></svg> Continue with Google <span class="req">Required</span>
        </button>
      </div>

      <span class="step-lbl">Step 2 &middot; Main AI engines</span>
      <div class="prov-head">
        <span class="pn">Gemini <em class="prov-tag">main ai</em></span>
        <button class="prov-btn" id="gemToggle" type="button">Connect key</button>
      </div>
      <form class="api-form" id="gemForm">
        <input id="gemKey" type="password" autocomplete="off" placeholder="AIza... &mdash; your Gemini API key">
        <button class="api-connect" type="submit">Connect Gemini</button>
      </form>
      <div class="prov-head">
        <span class="pn">Z.ai <em class="prov-tag">main ai</em></span>
        <button class="prov-btn" id="zaiToggle" type="button">Connect key</button>
      </div>
      <form class="api-form" id="zaiForm">
        <input id="zaiKey" type="password" autocomplete="off" placeholder="sk-... &mdash; your Z.ai API key (api.z.ai)">
        <button class="api-connect" type="submit">Connect Z.ai</button>
      </form>

      <span class="step-lbl">Step 3 &middot; Local models &mdash; free</span>
      <div class="prov-head"><span class="pn">LFM3-1 <em class="prov-tag free">LiquidAI &middot; free</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="lfm" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Decisions Fast <em class="prov-tag free">Parallel &middot; free</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="parallel" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Big Pickle <em class="prov-tag">local</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="pickle" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Kimi <em class="prov-tag">local</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="kimi" checked><span class="tr"></span></label></div>

      <span class="step-lbl">Optional</span>
      <div class="login-stack">
        <button class="auth-btn" id="loginDiscord" type="button">
          <svg class="ic"><use href="#i-discord"/></svg> Continue with Discord <span class="sub">extra account</span>
        </button>
      </div>

      <div class="sync-line" id="syncLine"></div>
    </div>'''
NEW_BOX = '''    <div class="login-box" id="modelBox">
      <h3>AI Models</h3>
      <div class="prov-head">
        <span class="pn">Z.ai <em class="prov-tag">main ai</em></span>
        <button class="prov-btn" id="zaiToggle" type="button">Connect key</button>
      </div>
      <form class="api-form" id="zaiForm">
        <input id="zaiKey" type="password" autocomplete="off" placeholder="sk-... &mdash; your Z.ai API key (api.z.ai)">
        <button class="api-connect" type="submit">Connect Z.ai</button>
      </form>
      <div class="sync-line" id="zaiLine"></div>
      <div class="sync-line" id="syncLine"></div>
    </div>'''
rep(OLD_BOX, NEW_BOX, "sidebar-box")

# ============================================================
# 4. STATE — defaults + migrate
# ============================================================
rep("    user: null,              // {provider:'google'|'discord', name:'...'} — Google is required for the AI",
    "    user: null,              // optional Google/Discord link — only marks chats as synced\n    zaiKey: null,            // Z.ai API key — the engine that runs the app; never leaves this browser",
    "defaults-user")

rep("  if(!S.local) S.local = { lfm: true, parallel: true, pickle: true, kimi: true };",
    "  if(!S.local) S.local = { lfm: true, parallel: true, pickle: true, kimi: true };\n  if(!('zaiKey' in S)) S.zaiKey = null;",
    "migrate-zaikey")

# ============================================================
# 5. AUTH BLOCK — drop requireAuth/isGoogle gate, keep optional link()
# ============================================================
OLD_AUTH = '''/* ---------- auth ---------- */
function isGoogle(){ return !!(S.user && S.user.provider === 'google'); }
function requireAuth(){
  if(isGoogle()) return true;
  toast('Step 1 — sign in with Google to unlock the AI');
  const lb = $('#loginBox');
  lb.classList.remove('pulse'); void lb.offsetWidth; lb.classList.add('pulse');
  return false;
}
function login(provider){
  S.user = provider === 'google'
    ? { provider: 'google',   name: 'YUX FF (Google)' }
    : { provider: 'discord',  name: 'YUX FF (Discord)' };
  S.lastSync = now();
  save(); renderAccounts(); renderChat();
  toast('Logged in with ' + provider.charAt(0).toUpperCase() + provider.slice(1));
  if(provider === 'google') toast('AI unlocked — connect Gemini or Z.ai in Step 2 for full power');
}
function connectEngine(which, e){
  e.preventDefault();
  if(!requireAuth()) return;
  const inp = $(which === 'gemini' ? '#gemKey' : '#zaiKey');
  const key = inp.value.trim();
  if(!key){ toast('Paste your ' + (which === 'gemini' ? 'Gemini' : 'Z.ai') + ' API key first'); return; }
  if(which === 'gemini') S.gemini = { model: 'gemini-2.5-pro' };
  else                   S.zai    = { model: 'glm-4.6' };
  inp.value = '';                                   // the key itself never leaves this browser
  $(which === 'gemini' ? '#gemForm' : '#zaiForm').classList.remove('open');
  const btn = $(which === 'gemini' ? '#gemToggle' : '#zaiToggle');
  btn.textContent = 'Connected'; btn.classList.add('ok');
  save(); renderModels(); renderChat();
  toast((which === 'gemini' ? 'Gemini' : 'Z.ai') + ' connected — main AI ready');
}
function logout(){
  S.user = null; S.lastSync = null;
  save(); renderAccounts(); renderChat();
  toast('Signed out — the AI needs Google login');
}
function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}'''
NEW_AUTH = '''/* ---------- auth & engine status ---------- */
function zaiReady(){ return !!(S.zai && S.zaiKey); }
function login(provider){                            // optional account link (chat sync only)
  S.user = provider === 'google'
    ? { provider: 'google',   name: 'YUX FF (Google)' }
    : { provider: 'discord',  name: 'YUX FF (Discord)' };
  S.lastSync = now();
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Linked ' + provider.charAt(0).toUpperCase() + provider.slice(1) + ' — chats are marked as synced');
}
function connectEngine(which, e){                    // Z.ai only — the one main engine
  e.preventDefault();
  const key = $('#zaiKey').value.trim();
  if(!key){ toast('Paste your Z.ai API key first'); return; }
  S.zai = { model: 'glm-4.6' };
  S.zaiKey = key;                                   // stays in this browser only
  $('#zaiKey').value = '';
  $('#zaiForm').classList.remove('open');
  const btn = $('#zaiToggle');
  btn.textContent = 'Connected'; btn.classList.add('ok');
  save(); renderModels(); renderChat(); renderStatus(); renderZaiLine();
  toast('Z.ai connected — GLM-4.6 now runs every answer');
}
function logout(){
  S.user = null; S.lastSync = null;
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Unlinked — chats keep saving in this browser');
}
function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}'''
rep(OLD_AUTH, NEW_AUTH, "auth-block")

# ============================================================
# 6. renderChat — composer always on, Z.ai-first copy
# ============================================================
OLD_RC = '''  const inp = $('#chatInput');
  inp.disabled = !isGoogle();
  inp.placeholder = isGoogle() ? 'Message XR CODE...' : 'Sign in with Google to message XR CODE...';
  const box = $('#msgs'); box.innerHTML = '';
  if(!c.messages.length){
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.innerHTML = isGoogle()
      ? '<span class="big">XR CODE</span>Ask anything — the AI routes between Gemini and Z.ai automatically and does the work for you.'
      : '<span class="big">XR CODE</span>Step 1 — sign in with Google in the sidebar. After that the AI does the work: it plans, codes and reviews on its own.';
    box.append(e); return;
  }'''
NEW_RC = '''  const inp = $('#chatInput');
  inp.disabled = false;
  inp.placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until you connect Z.ai...';
  const box = $('#msgs'); box.innerHTML = '';
  if(!c.messages.length){
    const e = document.createElement('div');
    e.className = 'empty-state';
    e.innerHTML = zaiReady()
      ? '<span class="big">XR CODE</span>Ask anything — GLM-4.6 via Z.ai runs every answer: it plans, codes and reviews on its own.'
      : '<span class="big">XR CODE</span>Running on the built-in XR Core demo brain. Connect Z.ai in the sidebar (AI Models) to run the real engine.';
    box.append(e); return;
  }'''
rep(OLD_RC, NEW_RC, "renderChat")

# ============================================================
# 7. ENGINE POOL / ROUTING — Z.ai only
# ============================================================
OLD_POOL = '''/* ---------- model routing (token saver, Gemini + Z.ai) ---------- */
function enginePool(){
  const pool = [];
  if(S.local.lfm)      pool.push({ id: 'lfm',      name: 'LFM3-1 · LiquidAI',         heavy: false, free: true });
  if(S.local.parallel) pool.push({ id: 'parallel', name: 'Decisions Fast · Parallel', heavy: false, free: true });
  if(S.local.pickle)   pool.push({ id: 'pickle',   name: 'Big Pickle',                heavy: false, free: true });
  if(S.local.kimi)     pool.push({ id: 'kimi',     name: 'Kimi',                      heavy: false, free: true });
  if(S.gemini && S.models.flash !== false) pool.push({ id: 'flash', name: 'Gemini 2.5 Flash', heavy: false });
  if(S.zai    && S.models.glm  !== false) pool.push({ id: 'glm',   name: 'GLM-4.6 · Z.ai',  heavy: true  });
  if(S.gemini && S.models.pro  !== false) pool.push({ id: 'pro',   name: 'Gemini 2.5 Pro',  heavy: true  });
  return pool;
}
function routeModel(text){
  const pool = enginePool();
  if(!pool.length) return { id: 'core', name: 'XR Core', heavy: false, free: false };  // built-in demo brain
  if(!S.routing){                                                          // strongest available engine
    const all = pool.filter(m => m.heavy);
    return all.length ? all[all.length - 1] : pool[pool.length - 1];
  }
  const codey = /(code|function|bug|debug|error|build|script|api|css|html|python|refactor|c\\+\\+|java|js)/i.test(text) && text.length > 60;
  if(codey){ const h = pool.filter(m => m.heavy); if(h.length) return h[0]; }
  const free = pool.filter(m => m.free);
  if(free.length) return free[0];                                          // free local models first — zero cost
  const c = pool.filter(m => !m.heavy);
  return c.length ? c[0] : pool[0];
}
function estSaved(text, m){
  if(m.heavy || m.id === 'core') return 0;
  return Math.max(30, Math.round((text.length / 4) * 0.85));               // instead of a heavy model
}'''
NEW_POOL = '''/* ---------- engine (Z.ai only) ---------- */
function enginePool(){
  const pool = [];
  if(S.zai) pool.push({ id: 'glm', name: 'GLM-4.6 · Z.ai', heavy: true });
  return pool;
}
function routeModel(text){
  const pool = enginePool();
  if(!pool.length) return { id: 'core', name: 'XR Core', heavy: false, free: false };  // built-in demo brain
  return pool[0];
}
function estSaved(text, m){
  return 0;                                                                // single live engine — nothing to arbitrage
}'''
rep(OLD_POOL, NEW_POOL, "engine-pool")

# ============================================================
# 8. sendMsg — live Z.ai call when connected, demo brain otherwise
# ============================================================
OLD_SEND = '''  const model = routeModel(text);
  const saved = estSaved(text, model);
  const reply = genReply(text);
  typeReply(c, reply, model, saved);
  $('#chatModelChip').textContent = 'engine: ' + model.name + (S.routing ? ' · auto' : '');
}'''
NEW_SEND = '''  const model = routeModel(text);
  $('#chatModelChip').textContent = 'engine: ' + model.name + (model.id === 'glm' ? ' · live' : ' · demo');
  if(model.id === 'glm' && S.zaiKey){
    zaiChat(c, text, model);
  } else {
    if(model.id === 'core') toast('Demo mode — connect Z.ai in AI Models to run the real engine');
    typeReply(c, genReply(text), model, 0);
  }
}'''
rep(OLD_SEND, NEW_SEND, "sendMsg")

# ============================================================
# 9. Z.AI LIVE ENGINE — real API call (OpenAI-compatible endpoint)
# ============================================================
rep('''/* ---------- AI engine panel (settings) ---------- */''',
    '''/* ---------- Z.ai live engine (GLM-4.6, OpenAI-compatible) ---------- */
function zaiContext(c){
  return c.messages.slice(-12).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));
}
async function zaiChat(c, text, model){
  try{
    const res = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.zaiKey },
      body: JSON.stringify({ model: 'glm-4.6', messages: zaiContext(c), stream: false })
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const out = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    const t = (out || '').trim();
    if(!t) throw new Error('empty reply');
    typeReply(c, { text: t }, model, 0);
  }catch(err){
    const fb = genReply(text);
    typeReply(c, { text: 'Z.ai call failed (' + err.message + ') — XR Core fallback:\\n\\n' + fb.text },
      { id: 'core', name: 'XR Core (fallback)' }, 0);
  }
}

/* ---------- AI engine panel (settings) ---------- */''',
    "zaiChat-insert")

# ============================================================
# 10. renderModels — Z.ai only row (no switch, status tag)
# ============================================================
OLD_RM = '''  const rows = [
    { key: 'lfm',      name: 'LFM3-1 · LiquidAI',         role: 'Local model — free, handles planning & simple steps', tag: 'free',  cls: 'budget' },
    { key: 'parallel', name: 'Decisions Fast · Parallel', role: 'Local model — free, fast everyday decisions',         tag: 'free',  cls: 'budget' },
    { key: 'pickle',   name: 'Big Pickle',                role: 'Local model — community engine',                      tag: 'local', cls: 'budget' },
    { key: 'kimi',     name: 'Kimi',                      role: 'Local model — long-context helper',                   tag: 'local', cls: 'budget' },
    { key: 'flash',    name: 'Gemini 2.5 Flash', role: S.gemini ? 'Planning & simple steps — cheap and fast' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'budget' : 'key needed', cls: 'budget', need: true },
    { key: 'pro',      name: 'Gemini 2.5 Pro',   role: S.gemini ? 'Deep reasoning & code — used only when needed' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'heavy' : 'key needed', cls: 'heavy', need: true },
    { key: 'glm',      name: 'GLM-4.6 · Z.ai',   role: S.zai ? 'Heavy code engine from Z.ai' : 'Connect your Z.ai API key (Step 2) to enable', tag: S.zai ? 'heavy' : 'key needed', cls: 'heavy', need: true }
  ];
  rows.forEach(r => {
    const row = document.createElement('div'); row.className = 'model-row';
    const info = document.createElement('div'); info.className = 'mi';
    const n = document.createElement('div'); n.className = 'mn'; n.textContent = r.name;
    const rr = document.createElement('div'); rr.className = 'mr'; rr.textContent = r.role;
    info.append(n, rr);
    const t = document.createElement('span'); t.className = 'tagm ' + r.cls; t.textContent = r.tag;
    const sw = document.createElement('label'); sw.className = 'switch';
    const inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!S.models[r.key];
    inp.disabled = r.need ? !(r.key === 'glm' ? S.zai : S.gemini) : false;
    inp.onchange = () => { S.models[r.key] = inp.checked; save(); toast(r.name + (inp.checked ? ' enabled' : ' disabled for routing')); };
    const tr = document.createElement('span'); tr.className = 'tr';
    sw.append(inp, tr);
    row.append(info, t, sw);
    p.append(row);
  });'''
NEW_RM = '''  const rows = [
    { name: 'GLM-4.6 · Z.ai',
      role: zaiReady() ? 'Main engine — runs the whole app: planning, code, review'
                       : 'Connect your Z.ai API key (sidebar — AI Models) to run the real engine',
      tag: zaiReady() ? 'main' : 'key needed', cls: 'heavy' }
  ];
  rows.forEach(r => {
    const row = document.createElement('div'); row.className = 'model-row';
    const info = document.createElement('div'); info.className = 'mi';
    const n = document.createElement('div'); n.className = 'mn'; n.textContent = r.name;
    const rr = document.createElement('div'); rr.className = 'mr'; rr.textContent = r.role;
    info.append(n, rr);
    const t = document.createElement('span'); t.className = 'tagm ' + r.cls; t.textContent = r.tag;
    row.append(info, t);
    p.append(row);
  });'''
rep(OLD_RM, NEW_RM, "renderModels")

# ============================================================
# 11. renderAccounts — optional link buttons in Settings
# ============================================================
OLD_RA = '''    const s = document.createElement('div'); s.className = 'as';
    const eng = [S.gemini && 'Gemini', S.zai && 'Z.ai'].filter(Boolean).join(' + ');
    s.textContent = 'Chats save to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '') +
      (eng ? ' · engines: ' + eng : ' · connect Gemini or Z.ai (Step 2) for the full engine');
    i.append(n, s);
    const b = document.createElement('button'); b.className = 'mini-btn danger'; b.type = 'button'; b.textContent = 'Sign out';
    b.onclick = logout;
    r.append(i, b); box.append(r);
  } else {
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Not signed in. Step 1 — use the login box in the left sidebar: Google first, then Gemini / Z.ai.';
    box.append(s);
  }'''
NEW_RA = '''    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Chats sync to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '') +
      ' · engine: ' + (zaiReady() ? 'GLM-4.6 (Z.ai)' : 'XR Core (demo)');
    i.append(n, s);
    const b = document.createElement('button'); b.className = 'mini-btn danger'; b.type = 'button'; b.textContent = 'Unlink';
    b.onclick = logout;
    r.append(i, b); box.append(r);
  } else {
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Not linked. Connecting Google or Discord is optional — chats save in this browser either way.';
    const st = document.createElement('div'); st.className = 'login-stack'; st.style.marginTop = '8px';
    const g = document.createElement('button'); g.className = 'auth-btn'; g.type = 'button';
    g.innerHTML = '<svg class="ic"><use href="#i-g"/></svg> Link Google <span class="sub">optional</span>';
    const d = document.createElement('button'); d.className = 'auth-btn'; d.type = 'button';
    d.innerHTML = '<svg class="ic"><use href="#i-discord"/></svg> Link Discord <span class="sub">optional</span>';
    g.onclick = () => login('google');
    d.onclick = () => login('discord');
    st.append(g, d);
    box.append(s, st);
  }'''
rep(OLD_RA, NEW_RA, "renderAccounts")

# ============================================================
# 12. updateSyncUI copy + renderZaiLine helper
# ============================================================
rep("    span.textContent = 'Chats save locally — Step 1: log in with Google to save them to your account.';",
    "    span.textContent = 'Chats save locally — linking Google or Discord (Settings) is optional.';",
    "syncui-copy")

rep('''  el.append(ic, span);
}
function renderStatus(){''',
    '''  el.append(ic, span);
}
function renderZaiLine(){
  const el = $('#zaiLine'); if(!el) return;
  el.innerHTML = '';
  const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ic.setAttribute('class', 'ic small');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-cpu'); ic.append(use);
  const span = document.createElement('span');
  span.innerHTML = zaiReady()
    ? '<b>GLM-4.6 live</b> — Z.ai runs planning, code and review'
    : '<b>Demo mode</b> — XR Core answers until a Z.ai key is connected';
  el.append(ic, span);
}
function renderStatus(){''',
    "renderZaiLine-def")

# ============================================================
# 13. renderStatus — engine-first status bar
# ============================================================
rep('''  const d = document.createElement('span'); d.className = 'dot' + (S.user ? ' on' : '');
  el.append(d, document.createTextNode(S.user ? 'Connected · ' + S.user.name : 'Not signed in'));''',
    '''  const on = zaiReady() || S.user;
  const d = document.createElement('span'); d.className = 'dot' + (on ? ' on' : '');
  el.append(d, document.createTextNode(
    zaiReady() ? 'Z.ai connected · GLM-4.6'
    : S.user   ? 'Linked · ' + S.user.name + ' · demo engine'
               : 'Z.ai not connected — demo mode'));''',
    "renderStatus")

# ============================================================
# 14. WIRING — drop the gate + dead element handlers
# ============================================================
rep('''$('#homeForm').addEventListener('submit', e => {
  e.preventDefault();
  if(!requireAuth()){ $('#homeInput').value = ''; return; }
  S.active = null;                       // fresh chat from home
  sendMsg($('#homeInput').value);
  $('#homeInput').value = '';
});
$$('#quickCards .card').forEach(c => c.onclick = () => { if(!requireAuth()) return; S.active = null; sendMsg(c.dataset.q); });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); if(!requireAuth()) return; sendMsg($('#chatInput').value); $('#chatInput').value = ''; });''',
    '''$('#homeForm').addEventListener('submit', e => {
  e.preventDefault();
  S.active = null;                       // fresh chat from home
  sendMsg($('#homeInput').value);
  $('#homeInput').value = '';
});
$$('#quickCards .card').forEach(c => c.onclick = () => { S.active = null; sendMsg(c.dataset.q); });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });''',
    "wiring-forms")

rep('''$('#loginGoogle').onclick = () => login('google');
$('#loginDiscord').onclick = () => login('discord');
$('#gemToggle').onclick = () => { if(!requireAuth()) return; $('#gemForm').classList.toggle('open'); $('#gemKey').focus(); };
$('#zaiToggle').onclick = () => { if(!requireAuth()) return; $('#zaiForm').classList.toggle('open'); $('#zaiKey').focus(); };
$('#gemForm').addEventListener('submit', e => connectEngine('gemini', e));
$('#zaiForm').addEventListener('submit', e => connectEngine('zai', e));''',
    '''$('#zaiToggle').onclick = () => { $('#zaiForm').classList.toggle('open'); $('#zaiKey').focus(); };
$('#zaiForm').addEventListener('submit', e => connectEngine('zai', e));''',
    "wiring-login")

rep('''$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));
$$('.localToggle').forEach(t => t.addEventListener('change', () => {
  const names = { lfm: 'LFM3-1', parallel: 'Decisions Fast', pickle: 'Big Pickle', kimi: 'Kimi' };
  S.local[t.dataset.k] = t.checked; save(); renderModels();
  toast(names[t.dataset.k] + (t.checked ? ' enabled' : ' disabled'));
}));''',
    '''$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));''',
    "wiring-local")

rep('''  if(!S.user){ toast('Log in first — Google (Step 1 in the sidebar)'); return; }''',
    '''  if(!S.user){ toast('Linking Google or Discord (Settings) is optional — chats already save in this browser'); return; }''',
    "syncNow-copy")

# ============================================================
# 15. INIT TAIL
# ============================================================
rep('''$$('.localToggle').forEach(t => t.checked = S.local[t.dataset.k] !== false);
if(S.gemini){ const b = $('#gemToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
$('#chatInput').disabled = !isGoogle();
if(!isGoogle()) $('#chatInput').placeholder = 'Sign in with Google to message XR CODE...';''',
    '''if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
renderZaiLine();
$('#chatInput').disabled = false;
$('#chatInput').placeholder = zaiReady() ? 'Message XR CODE...' : 'Ask anything — XR Core answers until you connect Z.ai...';''',
    "init-tail")

# ============================================================
# report + JS syntax check
# ============================================================
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

# sanity assertions
must_out = ["loginBox", "loginGoogle", "loginDiscord", "gemToggle", "gemForm", "gemKey",
            "requireAuth", "isGoogle", "LFM3-1 · LiquidAI", "Gemini 2.5 Flash", "Step 1",
            "login-with-google", "#loginGoogle'", "localToggle"]
for bad in must_out:
    if bad in src:
        print("LEFTOVER FOUND: " + bad); sys.exit(1)
must_in = ["modelBox", "AI Models", "zaiChat", "zaiReady", "zaiKey", "api.z.ai/api/paas/v4/chat/completions",
           "GLM-4.6", "renderZaiLine", "Link Google", "XR Core", "demo brain"]
for good in must_in:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

print("OK — zai_only applied:", len(src), "bytes")
