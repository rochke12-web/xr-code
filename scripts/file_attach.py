#!/usr/bin/env python3
"""XR CODE — file attach on the right of the send button:
- paperclip button (i-clip) right of send in the chat composer
- hidden multi-file picker + removable attachment chips above the input
- drag & drop files anywhere on the chat view
- text-like files are read and fed to the hosted AI as context
- sent messages show attachment chips (image thumbs persist when small)"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-attach.html'

src = open(SRC, encoding='utf-8').read()
if 'fileBtn' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. sprite: paperclip + file icons (sprite string uses literal \n sequences) ----
src = rep(src,
    '\\n  <symbol id="i-chev"',
    '\\n  <symbol id="i-clip" viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></symbol>'
    '\\n  <symbol id="i-file" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></symbol>'
    '\\n  <symbol id="i-chev"')

# ---- 2. markup: file button to the RIGHT of the chat send button ----
src = rep(src,
"""<button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>""",
"""<button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>
        <button class="file-btn" id="fileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>""")

# ---- 3. composer CSS: allow the attach row to wrap above the input ----
src = rep(src,
""".composer{
  display:flex;gap:10px;padding:14px 24px 18px;border-top:1px solid var(--line);
  background:var(--panel);backdrop-filter:blur(12px);
}""",
""".composer{
  display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:14px 24px 18px;border-top:1px solid var(--line);
  background:var(--panel);backdrop-filter:blur(12px);
}""")

# ---- 4. attach UI styles (base, next to .send-btn rule) ----
src = rep(src,
""".send-btn{
  display:grid;place-items:center;width:44px;height:44px;border-radius:12px;flex:none;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-ink);
  transition:transform .15s ease, filter .15s;
}""",
""".send-btn{
  display:grid;place-items:center;width:44px;height:44px;border-radius:12px;flex:none;
  background:linear-gradient(135deg,var(--accent),var(--accent-2));color:var(--accent-ink);
  transition:transform .15s ease, filter .15s;
}
.file-btn{
  display:grid;place-items:center;width:44px;height:44px;border-radius:12px;flex:none;
  background:var(--panel-2);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line);
  transition:color .15s,box-shadow .15s;
}
.file-btn:hover{color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.attach-row{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px;padding:2px 2px 0}
.attach-row:empty{display:none}
.att-chip{display:inline-flex;align-items:center;gap:7px;max-width:100%;font-size:12px;color:var(--text);background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:5px 9px}
.att-chip .nm{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.att-chip .sz{color:var(--muted);font-size:10.5px;white-space:nowrap}
.att-chip .rm{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;color:var(--muted);flex:none;font-size:13px;line-height:1}
.att-chip .rm:hover{color:var(--danger);background:var(--panel)}
.att-chip img{width:26px;height:26px;object-fit:cover;border-radius:6px;flex:none}
.msg .att-line{display:flex;flex-wrap:wrap;gap:6px}
.composer.drop{box-shadow:inset 0 0 0 2px var(--accent)}""")

# ---- 5. motion: chip pop-in (inside the reduced-motion-guarded block) ----
src = rep(src,
"""    .view.slide-bck{animation:xr-view-bck .36s cubic-bezier(.3,.7,.3,1)}""",
"""    .view.slide-bck{animation:xr-view-bck .36s cubic-bezier(.3,.7,.3,1)}
    .att-chip{animation:xr-chipin .28s cubic-bezier(.3,.7,.3,1) backwards}
    @keyframes xr-chipin{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}""")

# ---- 6. sendMsg: take attachments, persist metas, hand live files to the brain ----
src = rep(src,
"""function sendMsg(text){
  text = (text || '').trim(); if(!text) return;
  const c = currentChat();
  if(c.title === 'New Project') c.title = text.slice(0, 34) + (text.length > 34 ? '...' : '');
  c.messages.push({ r: 'u', t: text });
  c.ts = now();
  showView('chat');
  renderChat(); save();

  askBrain(c, text);
}""",
"""function sendMsg(text){
  text = (text || '').trim(); if(!text) return;
  const c = currentChat();
  if(c.title === 'New Project') c.title = text.slice(0, 34) + (text.length > 34 ? '...' : '');
  const live = window.__takeAtts ? window.__takeAtts() : [];
  const atts = live.map(a => {                     // persist light metadata only (storage quota)
    const o = { n: a.n, sz: a.sz, ty: a.ty };
    if(a.d && a.d.length < 110000) o.d = a.d;      // small image previews survive reload
    return o;
  });
  c.messages.push({ r: 'u', t: text, att: atts });
  c.ts = now();
  showView('chat');
  renderChat(); save();

  askBrain(c, text, live);
}""")

# ---- 7. askBrain: enrich the last message with attached file contents ----
src = rep(src,
"""async function askBrain(c, text){""",
"""async function askBrain(c, text, atts){""")

src = rep(src,
"""    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: brainContext(c) })
    });""",
"""    let last = text;                               // feed file contents to the hosted brain
    (atts || []).forEach(a => {
      if(a.txt) last += '\\n\\n[attached file: ' + a.n + ']\\n' + String(a.txt).slice(0, 6000);
      else if((a.ty || '').indexOf('image/') === 0) last += '\\n\\n[attached image: ' + a.n + ' — ' + window.fmtSz(a.sz) + ']';
      else last += '\\n\\n[attached file: ' + a.n + ' — ' + window.fmtSz(a.sz) + ']';
    });
    const ctx = brainContext(c);
    if(ctx.length) ctx[ctx.length - 1].content = last;
    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: ctx })
    });""")

# ---- 8. msgEl: render attachment chips (thumb for images, file icon otherwise) ----
src = rep(src,
"""  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = m.t;
  w.append(who, b);
  if(m.code){ const pre = document.createElement('pre'); pre.textContent = m.code; w.append(pre); }""",
"""  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = m.t;
  w.append(who, b);
  if(m.att && m.att.length){
    const line = document.createElement('div'); line.className = 'att-line';
    m.att.forEach(a => {
      const chip = document.createElement('span'); chip.className = 'att-chip';
      if(a.d && (a.ty || '').indexOf('image/') === 0){
        const im = document.createElement('img'); im.src = a.d; im.alt = a.n; chip.append(im);
      }else{
        const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ic.setAttribute('class', 'ic small'); ic.innerHTML = '<use href="#i-file"/>';
        chip.append(ic);
      }
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.n; nm.title = a.n;
      chip.append(nm);
      if(window.fmtSz){ const sz = document.createElement('span'); sz.className = 'sz'; sz.textContent = window.fmtSz(a.sz); chip.append(sz); }
      line.append(chip);
    });
    w.append(line);
  }
  if(m.code){ const pre = document.createElement('pre'); pre.textContent = m.code; w.append(pre); }""")

# ---- 9. picker + chips + drag&drop engine, wired after the submit handler ----
src = rep(src,
"""$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });""",
"""$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });

/* ---------- file attach (paperclip right of send) ---------- */
(function(){
  const MAX_FILES = 4, MAX_BYTES = 8 * 1024 * 1024;
  window.fmtSz = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const TXT_RE = /\\.(txt|md|markdown|json|js|mjs|ts|tsx|jsx|py|rb|go|rs|java|kt|c|h|cpp|cs|php|sh|bash|yml|yaml|toml|ini|cfg|csv|tsv|html|htm|css|scss|xml|sql|log|env)$/i;
  let ATT = [];
  const form = $('#chatForm');
  const pick = document.createElement('input');
  pick.type = 'file'; pick.multiple = true; pick.hidden = true;
  form.appendChild(pick);
  const row = document.createElement('div');
  row.className = 'attach-row';
  form.prepend(row);
  const readText = f => new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || '').slice(0, 24000));
    r.onerror = () => res('');
    r.readAsText(f.slice(0, 200000));
  });
  const readDataURL = f => new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(String(r.result || ''));
    r.onerror = () => res('');
    r.readAsDataURL(f);
  });
  async function addFiles(list){
    for(const f of Array.from(list || [])){
      if(ATT.length >= MAX_FILES){ toast('Up to ' + MAX_FILES + ' files at once'); break; }
      if(f.size > MAX_BYTES){ toast(f.name + ' is too large (max 8 MB)'); continue; }
      const a = { n: f.name, sz: f.size, ty: f.type || '' };
      if((f.type || '').indexOf('image/') === 0 && f.size <= 300000){
        a.d = await readDataURL(f);
      }else if((f.type || '').indexOf('text/') === 0 || (f.type || '').indexOf('json') > -1 || TXT_RE.test(f.name)){
        a.txt = await readText(f);
      }
      ATT.push(a);
      draw();
    }
  }
  function draw(){
    row.innerHTML = '';
    ATT.forEach((a, i) => {
      const chip = document.createElement('span'); chip.className = 'att-chip';
      if(a.d){
        const im = document.createElement('img'); im.src = a.d; im.alt = a.n; chip.append(im);
      }else{
        const ic = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ic.setAttribute('class', 'ic small'); ic.innerHTML = '<use href="#i-file"/>';
        chip.append(ic);
      }
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = a.n; nm.title = a.n;
      const sz = document.createElement('span'); sz.className = 'sz'; sz.textContent = window.fmtSz(a.sz);
      const rm = document.createElement('button'); rm.className = 'rm'; rm.type = 'button'; rm.title = 'Remove'; rm.textContent = '\\u00d7';
      rm.onclick = () => { ATT.splice(i, 1); draw(); };
      chip.append(nm, sz, rm);
      row.append(chip);
    });
  }
  window.__takeAtts = () => { const out = ATT.slice(); ATT = []; draw(); return out; };
  $('#fileBtn').onclick = () => pick.click();
  pick.onchange = () => { addFiles(pick.files); pick.value = ''; };
  const view = $('#view-chat');                    // drag & drop anywhere on the chat
  ['dragover', 'dragenter'].forEach(ev => view.addEventListener(ev, e => {
    e.preventDefault();
    if(e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') > -1) form.classList.add('drop');
  }));
  view.addEventListener('dragleave', e => {
    if(!e.relatedTarget || !view.contains(e.relatedTarget)) form.classList.remove('drop');
  });
  view.addEventListener('drop', e => {
    e.preventDefault();
    form.classList.remove('drop');
    if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
})();""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('i-clip') == 2, core.count('i-clip')        # symbol + markup hook
assert core.count('i-file') == 3, core.count('i-file')        # symbol + 2 chip renders
assert core.count('fileBtn') == 2
assert core.count('attach-row') == 3                          # 2 css + 1 js
assert core.count('att-chip') == 9, core.count('att-chip')
assert core.count('__takeAtts') == 3, core.count('__takeAtts')   # def + guard + call
assert core.count('xr-chipin') == 2
assert core.count('readAsText') == 1 and core.count('readAsDataURL') == 1
assert core.count('attached file:') == 2 and core.count('attached image:') == 1
assert 'Prime AI' not in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — file attach wired (picker, chips, drag&drop, AI context, bubble previews)')
