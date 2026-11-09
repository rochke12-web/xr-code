#!/usr/bin/env python3
# model_select.py — model combobox between chat input and send button.
# Shows the selected Prime AI model; click expands a dropdown with extra models.
# The chosen model rides along on every /api/chat call. Idempotent + assertions.
import re, shutil

SRC = '/home/z/my-project/download/xr-code.html'
shutil.copyfile(SRC, '/home/z/my-project/scripts/xr-pre-modelsel.html')

src = open(SRC, encoding='utf-8').read()

def rep(out, old, new, n=1):
    c = out.count(old)
    assert c == n, f'anchor x{c} (want x{n}): {old[:90]!r}'
    return out.replace(old, new)

out = src

# ---- E1: CSS — selector button + dropdown menu
out = rep(out,
""".composer input:focus{border-color:var(--accent)}""",
""".composer input:focus{border-color:var(--accent)}
.model-wrap{position:relative;flex:none}
.model-btn{
  display:inline-flex;align-items:center;gap:7px;height:44px;max-width:200px;
  padding:0 13px;border-radius:12px;flex:none;cursor:pointer;border:none;
  background:var(--panel-2);color:var(--text);box-shadow:inset 0 0 0 1px var(--line);
  transition:color .15s,box-shadow .15s;
}
.model-btn:hover{color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.model-btn .ml{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);font-size:11.5px;letter-spacing:.02em}
.model-btn .caret{flex:none;font-size:9px;color:var(--muted);transition:transform .18s ease}
.model-wrap.open .model-btn .caret{transform:rotate(180deg)}
.model-wrap.open .model-btn{color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.model-menu{
  position:absolute;right:0;bottom:52px;min-width:250px;z-index:60;
  background:var(--panel);border:1px solid var(--line);border-radius:14px;
  box-shadow:0 18px 44px rgba(0,0,0,.45);padding:6px;
  display:none;flex-direction:column;
}
.model-wrap.open .model-menu{display:flex}
.model-menu .mh{font-size:10px;letter-spacing:.14em;color:var(--muted);padding:6px 10px 5px;text-transform:uppercase}
.model-item{
  display:flex;align-items:center;gap:8px;width:100%;text-align:left;
  padding:9px 10px;border-radius:9px;color:var(--text);font-size:12.5px;cursor:pointer;border:none;background:none;
}
.model-item:hover{background:var(--panel-2)}
.model-item .mi{font-family:var(--font-mono);font-size:11.5px}
.model-item .mt{margin-left:auto;font-size:9.5px;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.model-item.on .mi,.model-item.on .mt{color:var(--accent)}
@media (max-width:600px){.model-btn{max-width:124px;padding:0 10px}}""")

# ---- E2: HTML — the combobox between the chat input and the send button
out = rep(out,
"""        <input id="chatInput" autocomplete="off" placeholder="Message XR Code...">
        <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>""",
"""        <input id="chatInput" autocomplete="off" placeholder="Message XR Code...">
        <div class="model-wrap" id="modelWrap">
          <button class="model-btn" id="modelBtn" type="button" title="AI model"><span class="ml">prime-v1-flash</span><span class="caret">&#9662;</span></button>
          <div class="model-menu" id="modelMenu"></div>
        </div>
        <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>""")

# ---- E3: JS — selector logic + persisted choice
out = rep(out,
"""/* ---------- file attach (paperclip right of send) ---------- */""",
"""/* ---------- model selector (prime ai) ---------- */
(function(){
  const MODELS = [
    { id: 'prime-v1-flash', tag: 'default' },
    { id: 'prime-v1-vision', tag: 'vision' },
    { id: 'glm-5.3', tag: 'flagship' },
    { id: 'glm-5.2' },
    { id: 'glm-5.3-flash', tag: 'fast' },
    { id: 'deepseek-chat' },
    { id: 'deepseek-reasoner', tag: 'deep think' }
  ];
  const KEY = 'xr_model';
  const wrap = $('#modelWrap'), btn = $('#modelBtn'), menu = $('#modelMenu');
  const label = btn.querySelector('.ml');
  function cur(){
    let m = '';
    try{ m = localStorage.getItem(KEY) || ''; }catch(e){}
    return MODELS.some(x => x.id === m) ? m : MODELS[0].id;
  }
  function drawBtn(){ label.textContent = cur(); }
  function drawMenu(){
    menu.innerHTML = '';
    const h = document.createElement('div'); h.className = 'mh'; h.textContent = 'Prime AI models';
    menu.append(h);
    const c = cur();
    MODELS.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'model-item' + (m.id === c ? ' on' : '');
      const i = document.createElement('span'); i.className = 'mi'; i.textContent = m.id;
      b.append(i);
      const t = document.createElement('span'); t.className = 'mt'; t.textContent = m.id === c ? 'selected' : (m.tag || '');
      b.append(t);
      b.onclick = () => {
        try{ localStorage.setItem(KEY, m.id); }catch(e){}
        drawBtn(); drawMenu(); wrap.classList.remove('open');
        toast('Model: ' + m.id);
      };
      menu.append(b);
    });
  }
  btn.onclick = e => {
    e.stopPropagation();
    drawMenu();
    wrap.classList.toggle('open');
  };
  document.addEventListener('click', e => {
    if(!wrap.contains(e.target)) wrap.classList.remove('open');
  });
  drawBtn();
  window.__xrModel = cur;                        // the brain reads this on every send
})();

/* ---------- file attach (paperclip right of send) ---------- */""")

# ---- E4: send the chosen model with every brain call
out = rep(out,
"""  const call = () => fetch(API_BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: ctx })
  });""",
"""  const model = window.__xrModel ? window.__xrModel() : '';
  const call = () => fetch(API_BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: ctx, model: model })
  });""")

# ---- assertions
assert out.count('id="modelWrap"') == 1
assert out.count('id="modelBtn"') == 1
assert out.count('id="modelMenu"') == 1
assert out.count('.model-wrap{position:relative') == 1
assert out.count('window.__xrModel') == 3
assert out.count("model: model") == 1
assert out.count("Prime AI models") == 1
assert out.count("{ id: 'prime-v1-flash', tag: 'default' }") == 1

open(SRC, 'w', encoding='utf-8').write(out)

m = re.search(r'<script>(.*)</script>', out, re.S)
open('/tmp/xr_modelsel_check.js', 'w', encoding='utf-8').write(m.group(1))
print('OK — model selector added, snapshot at scripts/xr-pre-modelsel.html')
