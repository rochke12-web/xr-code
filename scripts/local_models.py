"""Add Step 3 — local/free models to XR CODE:
LiquidAI LFM3-1, Parallel Decisions Fast, Big Pickle, Kimi.
- Sidebar: Step 3 group with always-free toggles (no key needed)
- Settings AI Engine: model rows for all four
- Router: prefers free local models for simple work; heavy code still goes to Gemini Pro / GLM-4.6
"""
import re, os

OUT = '/home/z/my-project/download/xr-code.html'
html = open(OUT).read()

def rep(s, old, new, tag, count=1):
    n = s.count(old)
    assert n == count, f'[{tag}] expected {count} match(es), found {n}'
    return s.replace(old, new)

# ---------- 1. CSS: green "free" tag ----------
html = rep(html, '.prov-tag{font-style:normal;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);border:1px solid var(--accent-2);border-radius:999px;padding:1.5px 7px}',
                 '.prov-tag{font-style:normal;font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-2);border:1px solid var(--accent-2);border-radius:999px;padding:1.5px 7px}\n'
                 '.prov-tag.free{color:var(--ok);border-color:var(--ok)}', 'css-free-tag')

# ---------- 2. Sidebar: Step 3 local models ----------
html = rep(html, '''        <button class="api-connect" type="submit">Connect Z.ai</button>
      </form>

      <span class="step-lbl">Optional</span>''',
'''        <button class="api-connect" type="submit">Connect Z.ai</button>
      </form>

      <span class="step-lbl">Step 3 &middot; Local models &mdash; free</span>
      <div class="prov-head"><span class="pn">LFM3-1 <em class="prov-tag free">LiquidAI &middot; free</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="lfm" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Decisions Fast <em class="prov-tag free">Parallel &middot; free</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="parallel" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Big Pickle <em class="prov-tag">local</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="pickle" checked><span class="tr"></span></label></div>
      <div class="prov-head"><span class="pn">Kimi <em class="prov-tag">local</em></span><label class="switch"><input type="checkbox" class="localToggle" data-k="kimi" checked><span class="tr"></span></label></div>

      <span class="step-lbl">Optional</span>''', 'sidebar-step3')

# ---------- 3. State: S.local defaults + migration ----------
html = rep(html, '''    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)
    zai: null,               // {model:'glm-4.6'} when a Z.ai key is connected''',
'''    gemini: null,            // {model:'gemini-2.5-pro'} when a Gemini key is connected (key stays local only)
    zai: null,               // {model:'glm-4.6'} when a Z.ai key is connected
    local: { lfm: true, parallel: true, pickle: true, kimi: true },  // free local models (Step 3)''', 'defaults-local')
html = rep(html, '''  if(S.gemini === undefined) S.gemini = null;
  if(S.zai === undefined) S.zai = null;''',
'''  if(S.gemini === undefined) S.gemini = null;
  if(S.zai === undefined) S.zai = null;
  if(!S.local) S.local = { lfm: true, parallel: true, pickle: true, kimi: true };''', 'migrate-local')

# ---------- 4. Router: free locals first for simple work ----------
html = rep(html, '''function enginePool(){
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
  const codey = /(code|function|bug|debug|error|build|script|api|css|html|python|refactor|c\\+\\+|java|js)/i.test(text) && text.length > 60;
  if(codey){ const h = pool.filter(m => m.heavy); if(h.length) return h[0]; }
  const c = pool.filter(m => !m.heavy);
  return c.length ? c[0] : pool[0];
}''',
'''function enginePool(){
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
}''', 'router-local')

# ---------- 5. Settings AI Engine rows: four local models on top ----------
html = rep(html, '''  const rows = [
    { key: 'flash', name: 'Gemini 2.5 Flash', role: S.gemini ? 'Planning & simple steps — cheap and fast' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'budget' : 'key needed', cls: 'budget' },
    { key: 'pro',   name: 'Gemini 2.5 Pro',   role: S.gemini ? 'Deep reasoning & code — used only when needed' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'heavy' : 'key needed', cls: 'heavy' },
    { key: 'glm',   name: 'GLM-4.6 · Z.ai',   role: S.zai ? 'Heavy code engine from Z.ai' : 'Connect your Z.ai API key (Step 2) to enable', tag: S.zai ? 'heavy' : 'key needed', cls: 'heavy' }
  ];''',
'''  const rows = [
    { key: 'lfm',      name: 'LFM3-1 · LiquidAI',         role: 'Local model — free, handles planning & simple steps', tag: 'free',  cls: 'budget' },
    { key: 'parallel', name: 'Decisions Fast · Parallel', role: 'Local model — free, fast everyday decisions',         tag: 'free',  cls: 'budget' },
    { key: 'pickle',   name: 'Big Pickle',                role: 'Local model — community engine',                      tag: 'local', cls: 'budget' },
    { key: 'kimi',     name: 'Kimi',                      role: 'Local model — long-context helper',                   tag: 'local', cls: 'budget' },
    { key: 'flash',    name: 'Gemini 2.5 Flash', role: S.gemini ? 'Planning & simple steps — cheap and fast' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'budget' : 'key needed', cls: 'budget', need: true },
    { key: 'pro',      name: 'Gemini 2.5 Pro',   role: S.gemini ? 'Deep reasoning & code — used only when needed' : 'Connect your Gemini API key (Step 2) to enable', tag: S.gemini ? 'heavy' : 'key needed', cls: 'heavy', need: true },
    { key: 'glm',      name: 'GLM-4.6 · Z.ai',   role: S.zai ? 'Heavy code engine from Z.ai' : 'Connect your Z.ai API key (Step 2) to enable', tag: S.zai ? 'heavy' : 'key needed', cls: 'heavy', need: true }
  ];''', 'settings-rows')
html = rep(html, "    inp.disabled = !(r.key === 'glm' ? S.zai : S.gemini);",
                 "    inp.disabled = r.need ? !(r.key === 'glm' ? S.zai : S.gemini) : false;", 'toggle-need')

# ---------- 6. Wire-up + init ----------
OLD_WIRE = "$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));"
NEW_WIRE = ("$$('.routingToggle').forEach(t => t.addEventListener('change', () => setRouting(t.checked)));\n"
            "$$('.localToggle').forEach(t => t.addEventListener('change', () => {\n"
            "  const names = { lfm: 'LFM3-1', parallel: 'Decisions Fast', pickle: 'Big Pickle', kimi: 'Kimi' };\n"
            "  S.local[t.dataset.k] = t.checked; save(); renderModels();\n"
            "  toast(names[t.dataset.k] + (t.checked ? ' enabled' : ' disabled'));\n"
            "}));")
html = rep(html, OLD_WIRE, NEW_WIRE, 'wire-local')

OLD_INIT = "if(S.gemini){ const b = $('#gemToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }"
NEW_INIT = ("$$('.localToggle').forEach(t => t.checked = S.local[t.dataset.k] !== false);\n"
            "if(S.gemini){ const b = $('#gemToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }")
html = rep(html, OLD_INIT, NEW_INIT, 'init-local')

# ---------- sanity ----------
assert "$$$(" not in html, 'helper corruption detected ($$$( found)'
assert 'function estSaved(text, m){' in html, 'estSaved must follow the router'
for need in ('step-lbl">Step 3', 'localToggle', 'S.local.lfm', "id: 'pickle'", 'Decisions Fast · Parallel', 'prov-tag free'):
    assert need in html, 'missing: ' + need

open(OUT, 'w').write(html)
print('local models added  |  size:', os.path.getsize(OUT) // 1024, 'KB')
