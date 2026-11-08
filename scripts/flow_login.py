"""XR CODE flow rework (always starts from the xr-pre-flow.html snapshot):
1. REMOVE Agent mode (view, nav button, console, JS) — the chat AI does the work instead
2. Login flow: Step 1 Google (required) -> Step 2 Gemini + Z.ai main AI keys -> optional Discord
3. Chat is gated until Google login; routing runs on Gemini Flash/Pro + GLM-4.6
4. Light theme strict white & black overrides (grayscale scene/logo, black bubbles)
"""
import re, shutil, os

ROOT = '/home/z/my-project'
OUT  = f'{ROOT}/download/xr-code.html'
SNAP = f'{ROOT}/scripts/xr-pre-flow.html'
if not os.path.exists(SNAP):                 # keep the original pre-flow base, never overwrite it
    shutil.copy(OUT, SNAP)
html = open(SNAP).read()

def rep(s, old, new, tag, count=1):
    n = s.count(old)
    assert n == count, f'[{tag}] expected {count} match(es), found {n}'
    return s.replace(old, new)

# ============================================================
# 1. HTML — remove the Agent view entirely
# ============================================================
m = re.search(r'\n    <!-- ===== AGENT ===== -->.*?(?=    <!-- ===== SETTINGS ===== -->)', html, re.S)
assert m and 'view-agent' in m.group(0), 'agent section anchor not found'
html = html.replace(m.group(0), '\n    ')

# ============================================================
# 2. HTML — nav: drop the Agent button
# ============================================================
html = rep(html, '''      <button id="btnAgent" type="button"><svg class="ic"><use href="#i-cpu"/></svg> Agent</button>\n''', '', 'nav-agent')

# ============================================================
# 3. HTML — settings: Agent panel -> AI Engine panel (routing + models + saved tokens)
# ============================================================
html = rep(html, '''          <div class="panel">
            <h3><svg class="ic big"><use href="#i-cpu"/></svg> Agent</h3>
            <div class="switch-row">
              <span class="lbl">Smart model routing<small>Agent changes models automatically to save tokens</small></span>
              <label class="switch"><input type="checkbox" class="routingToggle" checked><span class="tr"></span></label>
            </div>
          </div>''', '''          <div class="panel">
            <h3><svg class="ic big"><use href="#i-cpu"/></svg> AI Engine</h3>
            <div class="switch-row">
              <span class="lbl">Smart model routing<small>XR CODE switches between Gemini and Z.ai automatically to save tokens</small></span>
              <label class="switch"><input type="checkbox" class="routingToggle" checked><span class="tr"></span></label>
            </div>
            <div id="modelsPanel"></div>
            <div class="token-stat">
              <span class="num" id="tokSaved">0</span>
              <span class="cap">tokens saved by routing (est.)</span>
            </div>
          </div>''', 'settings-panel')

# ============================================================
# 4. HTML — sidebar login box: Step 1 Google (required) / Step 2 Gemini + Z.ai / optional Discord
# ============================================================
html = rep(html, '''    <div class="login-box">
      <h3>Log in</h3>
      <div class="login-stack" id="authButtons">
        <button class="auth-btn" id="loginGoogle" type="button">
          <svg class="ic"><use href="#i-g"/></svg> Continue with Google <span class="sub">saves chats</span>
        </button>
        <button class="auth-btn" id="loginDiscord" type="button">
          <svg class="ic"><use href="#i-discord"/></svg> Continue with Discord <span class="sub">saves chats</span>
        </button>
        <button class="auth-btn" id="loginApi" type="button">
          <svg class="ic"><use href="#i-key"/></svg> Use API key <span class="sub">any AI + base URL</span>
        </button>
      </div>

      <form class="api-form" id="apiForm">
        <label for="apiUrl">Base URL</label>
        <input id="apiUrl" autocomplete="off" placeholder="https://api.openai.com/v1">
        <label for="apiKey">API key</label>
        <input id="apiKey" type="password" autocomplete="off" placeholder="sk-...">
        <label for="apiModel">Model</label>
        <input id="apiModel" autocomplete="off" placeholder="gpt-4o, claude-3.5-sonnet, deepseek...">
        <button class="api-connect" type="submit">Connect API</button>
      </form>

      <div class="sync-line" id="syncLine"></div>
    </div>''', '''    <div class="login-box" id="loginBox">
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

      <span class="step-lbl">Optional</span>
      <div class="login-stack">
        <button class="auth-btn" id="loginDiscord" type="button">
          <svg class="ic"><use href="#i-discord"/></svg> Continue with Discord <span class="sub">extra account</span>
        </button>
      </div>

      <div class="sync-line" id="syncLine"></div>
    </div>''', 'login-box')

# ============================================================
# 5. HTML — hero pill copy (no more "Agent online")
# ============================================================
html = rep(html,
    '<span class="hero-pill"><span class="dot"></span> Agent online &mdash; auto model switching to save tokens</span>',
    '<span class="hero-pill"><span class="dot"></span> AI online &mdash; Google login &middot; Gemini + Z.ai engines</span>',
    'hero-pill')

# ============================================================
# 6. CSS — remove agent-only styles (keep .panel/.switch/.model-row/.token-stat for settings)
# ============================================================
html = rep(html, '''.agent-wrap{flex:1;overflow-y:auto;padding:26px;display:grid;grid-template-columns:380px 1fr;gap:22px;min-height:0}
''', '', 'css-agent-wrap')
html = rep(html, '''.agent-goal{
  width:100%;min-height:74px;resize:vertical;background:var(--bg2);border:1px solid var(--line);
  border-radius:11px;padding:11px 13px;font-size:13px;outline:none;line-height:1.55;
}
.agent-goal:focus{border-color:var(--accent)}
.agent-actions{display:flex;gap:10px}
.btn-primary{
  flex:1;display:flex;align-items:center;justify-content:center;gap:8px;
  border-radius:11px;padding:11px;font-size:13.5px;font-weight:600;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-ink);
}
.btn-ghost{
  display:flex;align-items:center;justify-content:center;gap:8px;
  border:1px solid var(--line);border-radius:11px;padding:11px 14px;font-size:13px;color:var(--muted);
}
.btn-ghost:hover{color:var(--danger);border-color:var(--danger)}
''', '', 'css-agent-goal')
html = rep(html, '''/* console */
.console{
  font-family:var(--font-mono);font-size:12px;line-height:1.7;
  background:var(--bg2);border:1px solid var(--line);border-radius:var(--radius);
  padding:18px;flex:1;overflow-y:auto;min-height:220px;
}
.console .c-head{color:var(--muted);letter-spacing:.1em;font-size:10.5px;text-transform:uppercase;margin-bottom:10px}
.step{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line-soft);align-items:flex-start}
.step:last-child{border-bottom:none}
.step .s-dot{flex:none;width:9px;height:9px;border-radius:50%;margin-top:5px;background:var(--line)}
.step.run .s-dot{background:var(--accent-2);box-shadow:0 0 8px var(--accent-2);animation:pulse 1s infinite}
.step.done .s-dot{background:var(--ok)}
.step .s-body{flex:1;min-width:0}
.step .s-t{color:var(--text)}
.step .s-m{color:var(--accent);font-size:10.5px}
.step .s-o{color:var(--muted);font-size:11px;margin-top:2px}
.step .s-save{color:var(--ok);font-size:10.5px}
@keyframes pulse{50%{opacity:.35}}
.agent-status{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--muted)}
.agent-status .st-dot{width:8px;height:8px;border-radius:50%;background:var(--line)}
.agent-status.running .st-dot{background:var(--accent-2);animation:pulse .9s infinite}
.agent-status.done .st-dot{background:var(--ok)}
.agent-status.stopped .st-dot{background:var(--danger)}
''', '', 'css-console')
html = rep(html, '  .agent-wrap{grid-template-columns:1fr}\n', '', 'css-mq-agent')
html = rep(html, '''  .topbar{grid-template-columns:auto 1fr auto}
  .title-center h1{font-size:16px;letter-spacing:.28em}''', '''  .topbar{grid-template-columns:auto 1fr auto}
  .title-center h1{font-size:16px;letter-spacing:.28em}
  .brand .made{display:none}
  .version-badge{display:none}''', 'css-mobile-topbar')
html = rep(html, '''/* ============================================================
   AGENT VIEW
   ============================================================ */''', '''/* ============================================================
   AI ENGINE (lives in Settings now)
   ============================================================ */''', 'css-agent-banner')

# ============================================================
# 7. CSS — login steps, provider rows, pulse + light white&black overrides
# ============================================================
html = rep(html, '''/* responsive */''', '''/* ---------- login steps + main AI providers ---------- */
.step-lbl{display:block;font-size:9.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:8px 0 2px}
.auth-btn .req{margin-left:auto;font-size:9px;letter-spacing:.14em;text-transform:uppercase;border:1px solid var(--accent-2);color:var(--accent-2);border-radius:999px;padding:2px 8px;white-space:nowrap}
.prov-head{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:3px 1px}
.prov-head .pn{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:7px}
.prov-tag{font-style:normal;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);border:1px solid var(--accent-2);border-radius:999px;padding:1.5px 7px}
.prov-btn{font-size:11.5px;border:1px solid var(--line);border-radius:8px;padding:5px 11px;color:var(--muted);white-space:nowrap;transition:border-color .15s,color .15s}
.prov-btn:hover{color:var(--text);border-color:var(--accent)}
.prov-btn.ok{color:var(--ok);border-color:var(--ok)}
.login-box.pulse{animation:loginPulse .9s ease 2}
@keyframes loginPulse{50%{box-shadow:0 0 0 3px var(--col-line)}}

/* ---------- light theme: strict white & black ---------- */
:root[data-theme="light"] .hero h2 .thin{background:linear-gradient(160deg,#1a1c20 8%,#3c4046 46%,#85898f 82%);-webkit-background-clip:text;background-clip:text}
:root[data-theme="light"] .msg.u .bubble{background:linear-gradient(135deg,#3a3d43,#101216);color:#ffffff}
:root[data-theme="light"] .scene.light-only{filter:grayscale(1) contrast(1.07) brightness(1.03)}
:root[data-theme="light"] .logo .light-only{filter:grayscale(1) contrast(1.12) brightness(.92)}
:root[data-theme="light"] .clouds{filter:grayscale(1);opacity:.4}

/* responsive */''', 'css-new-block')

# ============================================================
# 8. JS — state defaults + migration (gemini/zai engines)
# ============================================================
html = rep(html, r'''    user: null,              // {provider:'google'|'discord'|'api', name:'...'}
    api: null,               // {url, model}  (key stays local only)
    routing: true,           // smart model routing
    models: { heavy: true, mini: true, custom: true },''', r'''    user: null,              // {provider:'google'|'discord', name:'...'} — Google is required for the AI
    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)
    zai: null,               // {model:'glm-4.6'} when a Z.ai key is connected
    routing: true,           // smart model routing
    models: { flash: true, pro: true, glm: true },''', 'js-defaults')
html = rep(html, r'''let S = load() || defaults();''', r'''let S = load() || defaults();
(function migrate(){
  if(!('flash' in (S.models || {}))) S.models = { flash: true, pro: true, glm: true };
  if(S.gemini === undefined) S.gemini = null;
  if(S.zai === undefined) S.zai = null;
  if(S.user && S.user.provider === 'api') S.user = null;
  delete S.api;
})();''', 'js-migrate')

# ============================================================
# 9. JS — views (agent removed)
# ============================================================
html = rep(html, '''const VIEWS = ['home', 'chat', 'agent', 'settings'];
function showView(name){
  VIEWS.forEach(v => $('#view-' + v).classList.toggle('active', v === name));
  $$('#btnHome,#btnSearch,#btnProject,#btnAgent,#btnSettings').forEach(b => b.classList.remove('current'));
  if(name === 'home') $('#btnHome').classList.add('current');
  if(name === 'chat') $('#btnSearch').classList.add('current');
  if(name === 'agent') $('#btnAgent').classList.add('current');
  if(name === 'settings') $('#btnSettings').classList.add('current');
  if(name === 'chat') renderChat();
  if(name === 'agent') renderModels();
}''', '''const VIEWS = ['home', 'chat', 'settings'];
function showView(name){
  VIEWS.forEach(v => $('#view-' + v).classList.toggle('active', v === name));
  $$('#btnHome,#btnSearch,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));
  if(name === 'home') $('#btnHome').classList.add('current');
  if(name === 'chat') $('#btnSearch').classList.add('current');
  if(name === 'settings') $('#btnSettings').classList.add('current');
  if(name === 'chat') renderChat();
  if(name === 'settings') renderModels();
}''', 'js-views')

# ============================================================
# 10. JS — auth: Google required, Gemini/Z.ai connectors, gate helper
# ============================================================
html = rep(html, r'''/* ---------- auth ---------- */
function login(provider){
  if(provider === 'api'){ $('#apiForm').classList.toggle('open'); return; }
  S.user = provider === 'google'
    ? { provider: 'google',   name: 'YUX FF (Google)' }
    : { provider: 'discord',  name: 'YUX FF (Discord)' };
  S.lastSync = now();
  save(); renderAccounts();
  toast('Logged in with ' + provider.charAt(0).toUpperCase() + provider.slice(1));
  toast('Chats now save to your ' + provider + ' account');
}
function connectApi(e){
  e.preventDefault();
  const url = $('#apiUrl').value.trim(), key = $('#apiKey').value.trim(), model = $('#apiModel').value.trim() || 'custom-model';
  if(!url || !key){ toast('Base URL and API key are required'); return; }
  S.api = { url: url, model: model };   // key is kept locally, never displayed
  S.user = { provider: 'api', name: 'Custom API (' + model + ')' };
  S.lastSync = now();
  save(); renderAccounts(); renderModels();
  $('#apiForm').classList.remove('open');
  $('#apiKey').value = '';
  toast('API connected: ' + model);
}
function logout(){
  S.user = null; S.api = null; S.lastSync = null;
  save(); renderAccounts(); renderModels();
  toast('Signed out');
}
function providerLabel(p){
  return p === 'google' ? 'your Google account'
       : p === 'discord' ? 'your Discord account'
       : 'your API workspace';
}''', r'''/* ---------- auth ---------- */
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
}''', 'js-auth')

# ============================================================
# 11. JS — chat empty state + composer gate
# ============================================================
html = rep(html, '''function renderChat(){
  const c = currentChat();
  $('#chatTitle').textContent = c.title;''', '''function renderChat(){
  const c = currentChat();
  $('#chatTitle').textContent = c.title;
  const inp = $('#chatInput');
  inp.disabled = !isGoogle();
  inp.placeholder = isGoogle() ? 'Message XR CODE...' : 'Sign in with Google to message XR CODE...';''', 'js-renderchat-gate')
html = rep(html, '''    e.innerHTML = '<span class="big">XR CODE</span>Start a project — ask anything below, or open the Agent from the sidebar to let it work on a goal on its own.';''',
'''    e.innerHTML = isGoogle()
      ? '<span class="big">XR CODE</span>Ask anything — the AI routes between Gemini and Z.ai automatically and does the work for you.'
      : '<span class="big">XR CODE</span>Step 1 — sign in with Google in the sidebar. After that the AI does the work: it plans, codes and reviews on its own.';''', 'js-empty-state')

# ============================================================
# 12. JS — routing on Gemini Flash / GLM-4.6 / Gemini Pro (+ built-in demo brain)
# ============================================================
html = rep(html, r'''/* ---------- model routing (token saver) ---------- */
function enabledPool(){
  const pool = [];
  if(S.models.mini)  pool.push('GPT-4o-mini');
  if(S.models.heavy) pool.push('GPT-4o');
  if(S.api && S.models.custom) pool.push(S.api.model);
  return pool.length ? pool : ['GPT-4o'];
}
function routeModel(text){
  const pool = enabledPool();
  const has = m => pool.includes(m);
  if(!S.routing) return has('GPT-4o') ? 'GPT-4o' : pool[0];
  const codey = /(code|function|bug|debug|error|build|script|api|css|html|python|refactor|c\+\+|java|js)/i.test(text) && text.length > 60;
  if(codey) return has('GPT-4o') ? 'GPT-4o' : pool[0];          // heavy work -> heavy model
  return has('GPT-4o-mini') ? 'GPT-4o-mini' : pool[0];          // everything else -> cheap model
}
function estSaved(text, model){
  if(model !== 'GPT-4o-mini') return 0;
  return Math.max(30, Math.round((text.length / 4) * 0.85));    // would have used the heavy model
}''', r'''/* ---------- model routing (token saver, Gemini + Z.ai) ---------- */
function enginePool(){
  const pool = [];
  if(S.gemini && S.models.flash !== false) pool.push({ id: 'flash', name: 'Gemini 2.5 Flash', heavy: false });
  if(S.zai    && S.models.glm  !== false) pool.push({ id: 'glm',   name: 'GLM-4.6 · Z.ai',  heavy: true  });
  if(S.gemini && S.models.pro  !== false) pool.push({ id: 'pro',   name: 'Gemini 2.5 Pro',  heavy: true  });
  return pool;
}
function routeModel(text){
  const pool = enginePool();
  if(!pool.length) return { id: 'core', name: 'XR Core', heavy: false };   // built-in demo brain
  if(!S.routing) return pool[pool.length - 1];                             // strongest available engine
  const codey = /(code|function|bug|debug|error|build|script|api|css|html|python|refactor|c\+\+|java|js)/i.test(text) && text.length > 60;
  if(codey){ const h = pool.filter(m => m.heavy); if(h.length) return h[0]; }
  const c = pool.filter(m => !m.heavy);
  return c.length ? c[0] : pool[0];
}
function estSaved(text, m){
  if(m.heavy || m.id === 'core') return 0;
  return Math.max(30, Math.round((text.length / 4) * 0.85));               // instead of a heavy model
}''', 'js-routing')

# ============================================================
# 13. JS — copy: no more Agent references
# ============================================================
html = rep(html, r'''  return { text: "Good question. The shortest path:\n\n1. Break the goal into 3 small steps.\n2. Solve the first one end to end before touching the rest.\n3. Keep everything in one project so the Agent can continue it.\n\nAsk me to generate, debug or build — or hand the goal to the Agent and let it work continuously." };''',
r'''  return { text: "Good question. The shortest path:\n\n1. Break the goal into 3 small steps.\n2. Solve the first one end to end before touching the rest.\n3. Keep everything in one project so I can continue it.\n\nAsk me to generate, debug or build — I pick the right model for every step and do the work for you." };''', 'js-genreply')

# ============================================================
# 14. JS — sendMsg/typeReply use engine objects
# ============================================================
html = rep(html, '''  const model = routeModel(text);
  const saved = estSaved(text, model);
  const reply = genReply(text);
  typeReply(c, reply, model, saved);
  $('#chatModelChip').textContent = 'model: ' + model + (S.routing ? ' (auto)' : '');''',
'''  const model = routeModel(text);
  const saved = estSaved(text, model);
  const reply = genReply(text);
  typeReply(c, reply, model, saved);
  $('#chatModelChip').textContent = 'engine: ' + model.name + (S.routing ? ' · auto' : '');''', 'js-sendmsg')
html = rep(html, "  chip.textContent = 'via ' + model + (S.routing ? ' · auto-routed' : '') + (saved ? ' · saved ~' + saved + ' tokens' : '');",
                 "  chip.textContent = 'via ' + model.name + (S.routing ? ' · auto-routed' : '') + (saved ? ' · saved ~' + saved + ' tokens' : '');", 'js-chip-live')
assert html.count("c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: model, saved: saved });") == 2
html = html.replace("c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: model, saved: saved });",
                    "c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: model.name, saved: saved });")

# ============================================================
# 15. JS — replace the whole agent section with the new renderModels (settings AI Engine)
# ============================================================
new_models = '''/* ---------- AI engine panel (settings) ---------- */
function renderModels(){
  const p = $('#modelsPanel'); if(!p) return; p.innerHTML = '';
  const rows = [
    { key: 'flash', name: 'Gemini 2.5 Flash', role: S.gemini ? 'Planning & simple steps — cheap and fast' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'budget' : 'key needed', cls: 'budget' },
    { key: 'pro',   name: 'Gemini 2.5 Pro',   role: S.gemini ? 'Deep reasoning & code — used only when needed' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'heavy' : 'key needed', cls: 'heavy' },
    { key: 'glm',   name: 'GLM-4.6 · Z.ai',   role: S.zai ? 'Heavy code engine from Z.ai' : 'Connect your Z.ai API key (Step 2) to enable', tag: S.zai ? 'heavy' : 'key needed', cls: 'heavy' }
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
    inp.disabled = !(r.key === 'glm' ? S.zai : S.gemini);
    inp.onchange = () => { S.models[r.key] = inp.checked; save(); toast(r.name + (inp.checked ? ' enabled' : ' disabled for routing')); };
    const tr = document.createElement('span'); tr.className = 'tr';
    sw.append(inp, tr);
    row.append(info, t, sw);
    p.append(row);
  });
}
'''
m = re.search(r'/\* ---------- agent ---------- \*/.*?(?=/\* ---------- accounts / sync UI ---------- \*/)', html, re.S)
assert m and 'runAgent' in m.group(0) and 'renderModels' in m.group(0), 'agent js section anchor not found'
html = html.replace(m.group(0), new_models)

# ============================================================
# 16. JS — accounts / sync copy
# ============================================================
html = rep(html, "    s.textContent = 'Not signed in. Use the login box on the right sidebar — Google, Discord or an API key.';",
                 "    s.textContent = 'Not signed in. Step 1 — use the login box in the left sidebar: Google first, then Gemini / Z.ai.';", 'js-acc-empty')
html = rep(html, '''    s.textContent = 'Chats save to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '');''',
'''    const eng = [S.gemini && 'Gemini', S.zai && 'Z.ai'].filter(Boolean).join(' + ');
    s.textContent = 'Chats save to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '') +
      (eng ? ' · engines: ' + eng : ' · connect Gemini or Z.ai (Step 2) for the full engine');''', 'js-acc-full')
html = rep(html, "    span.textContent = 'Chats save locally — log in with Google or Discord to save them to your account.';",
                 "    span.textContent = 'Chats save locally — Step 1: log in with Google to save them to your account.';", 'js-sync-else')

# ============================================================
# 17. JS — wire-up: gates + engine forms, no agent buttons
# ============================================================
html = rep(html, '''$('#homeForm').addEventListener('submit', e => {
  e.preventDefault();
  S.active = null;                       // fresh chat from home
  sendMsg($('#homeInput').value);
  $('#homeInput').value = '';
});
$$('#quickCards .card').forEach(c => c.onclick = () => { S.active = null; sendMsg(c.dataset.q); });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });''',
'''$('#homeForm').addEventListener('submit', e => {
  e.preventDefault();
  if(!requireAuth()){ $('#homeInput').value = ''; return; }
  S.active = null;                       // fresh chat from home
  sendMsg($('#homeInput').value);
  $('#homeInput').value = '';
});
$$('#quickCards .card').forEach(c => c.onclick = () => { if(!requireAuth()) return; S.active = null; sendMsg(c.dataset.q); });
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); if(!requireAuth()) return; sendMsg($('#chatInput').value); $('#chatInput').value = ''; });''', 'js-wire-forms')
html = rep(html, """$('#loginGoogle').onclick = () => login('google');
$('#loginDiscord').onclick = () => login('discord');
$('#loginApi').onclick = () => login('api');
$('#apiForm').addEventListener('submit', connectApi);

$('#agentRunBtn').onclick = runAgent;
$('#agentStopBtn').onclick = () => stopAgent(false);
$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));""",
"""$('#loginGoogle').onclick = () => login('google');
$('#loginDiscord').onclick = () => login('discord');
$('#gemToggle').onclick = () => { if(!requireAuth()) return; $('#gemForm').classList.toggle('open'); $('#gemKey').focus(); };
$('#zaiToggle').onclick = () => { if(!requireAuth()) return; $('#zaiForm').classList.toggle('open'); $('#zaiKey').focus(); };
$('#gemForm').addEventListener('submit', e => connectEngine('gemini', e));
$('#zaiForm').addEventListener('submit', e => connectEngine('zai', e));

$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));""", 'js-wire-auth')
html = rep(html, """$('#btnAgent').onclick = () => showView('agent');\n""", '', 'js-wire-btnagent')
html = rep(html, "  if(!S.user){ toast('Log in first — Google, Discord or API key'); return; }",
                 "  if(!S.user){ toast('Log in first — Google (Step 1 in the sidebar)'); return; }", 'js-syncnow')

# ============================================================
# 18. JS — init: restore connected states + gate the composer
# ============================================================
html = rep(html, '''$('#tokSaved').textContent = S.tokensSaved.toLocaleString();
$$('.routingToggle').forEach(t => t.checked = S.routing);
</script>''', '''$('#tokSaved').textContent = S.tokensSaved.toLocaleString();
$$('.routingToggle').forEach(t => t.checked = S.routing);
if(S.gemini){ const b = $('#gemToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
$('#chatInput').disabled = !isGoogle();
if(!isGoogle()) $('#chatInput').placeholder = 'Sign in with Google to message XR CODE...';
</script>''', 'js-init')

# ============================================================
# 19. settings copy — generic API workspace is gone
# ============================================================
html = rep(html, 'Chats are stored in this browser and marked as saved to your connected account (Google, Discord or your API workspace).',
                 'Chats are stored in this browser and marked as saved to your connected account (Google or Discord).', 'copy-note')

# ============================================================
# sanity: no stale references
# ============================================================
for stale in ('view-agent', 'btnAgent', 'agentGoal', 'agentRunBtn', 'agentStopBtn', 'agentConsole',
              'agentLog', 'agentStatus', 'runAgent', 'stopAgent', 'addStep', 'finishStep',
              'apiForm', 'apiUrl', 'apiKey', 'apiModel', 'loginApi', 'connectApi', 'GPT-4o'):
    assert stale not in html, 'stale reference remains: ' + stale
for need in ('id="loginBox"', 'id="gemForm"', 'id="zaiForm"', 'isGoogle()', 'requireAuth()',
             'enginePool', 'AI Engine', 'Step 1', 'Step 2', 'loginPulse', 'data-theme="light"] .scene'):
    assert need in html, 'missing: ' + need

open(OUT, 'w').write(html)
print('flow rework OK  |  size:', os.path.getsize(OUT) // 1024, 'KB')
