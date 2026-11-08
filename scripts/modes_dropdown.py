#!/usr/bin/env python3
"""XR CODE — modes redesign + AI file write:
- 4-pill row replaced by a compact combobox: [icon] Coder Mode [v] that expands
  into an animated dropdown listing exactly 2 modes (Coder Mode, QnA)
- AI code replies get a file bar: detected extension + 'save' button that
  downloads the code as a real multi-extension file (html/py/js/c/sql/...)"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-dropdown.html'

src = open(SRC, encoding='utf-8').read()
if 'mode-btn' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. markup: 4 pills -> one combobox button ----
src = rep(src,
"""<div class="mode-row" id="modeRow">
          <button class="mode-pill" type="button" data-mode="coder"><i class="ic small" data-ic="i-cpu"></i> Coder Mode</button>
          <button class="mode-pill" type="button" data-mode="qna"><i class="ic small" data-ic="i-qna"></i> QnA</button>
          <button class="mode-pill" type="button" data-mode="debug"><i class="ic small" data-ic="i-bug"></i> Debug Mode</button>
          <button class="mode-pill" type="button" data-mode="explain"><i class="ic small" data-ic="i-book"></i> Explain Mode</button>
        </div>""",
"""<div class="mode-box" id="modeRow">
          <button class="mode-btn" id="modeBtn" type="button" title="Choose mode">
            <i class="ic small mode-ico" data-ic="i-cpu"></i>
            <span id="modeCur">Coder Mode</span>
            <i class="ic small mchev" data-ic="i-down"></i>
          </button>
        </div>""")

# ---- 2. CSS: pill styles -> combobox styles ----
src = rep(src,
""".mode-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.mode-pill{
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.06em;color:var(--muted);
  border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:var(--panel);
  transition:color .18s,border-color .18s,background .18s;
}
.mode-pill:hover{color:var(--text);border-color:var(--accent-2)}
.mode-pill.current{color:var(--accent-ink);background:linear-gradient(135deg,var(--accent),var(--accent-2));border-color:transparent;font-weight:600}""",
""".mode-box{position:relative;display:flex;justify-content:center}
.mode-btn{
  display:inline-flex;align-items:center;gap:8px;
  font-family:var(--font-mono);font-size:11.5px;letter-spacing:.06em;color:var(--text);
  border:1px solid var(--line);border-radius:999px;padding:8px 15px;background:var(--panel-2);
  transition:border-color .18s,box-shadow .18s;
}
.mode-btn:hover{border-color:var(--accent-2);box-shadow:var(--shadow)}
.mode-btn .mchev{color:var(--muted)}
.mode-menu{
  position:absolute;top:calc(100% + 8px);left:50%;width:250px;
  transform:translateX(-50%) translateY(-8px) scale(.95);opacity:0;pointer-events:none;
  background:var(--panel-2);border:1px solid var(--line);border-radius:14px;
  box-shadow:var(--shadow);padding:6px;z-index:30;backdrop-filter:blur(14px);
}
.mode-box.open .mode-menu{transform:translateX(-50%) translateY(0) scale(1);opacity:1;pointer-events:auto}
.mode-box.open .mchev{transform:rotate(-180deg)}
.mode-opt{
  display:flex;align-items:center;gap:9px;width:100%;text-align:left;
  padding:9px 11px;border-radius:10px;font-size:12.5px;color:var(--text);
  transition:background .15s;
}
.mode-opt:hover{background:var(--panel)}
.mode-opt.current{background:var(--panel);color:var(--accent);box-shadow:inset 0 0 0 1px var(--line)}
.mode-opt .ol{font-weight:600}
.mode-opt .os{margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--muted)}""")

# ---- 3. motion: pill pop -> menu expand + arrow spin ----
src = rep(src,
"""    .mode-pill .ic{transition:transform .3s cubic-bezier(.3,.7,.3,1)}
    @keyframes xr-modepop{0%{transform:scale(.92)}55%{transform:scale(1.06)}100%{transform:scale(1)}}
    .mode-pill.current{animation:xr-modepop .32s cubic-bezier(.3,.7,.3,1)}""",
"""    .mode-menu{transition:opacity .22s ease,transform .32s cubic-bezier(.3,1.25,.35,1)}
    .mode-btn .mchev{transition:transform .3s cubic-bezier(.3,.7,.3,1)}""")

# ---- 4. modes controller -> combobox controller ----
src = rep(src,
"""/* ---------- modes (Coder / QnA / Debug / Explain) ---------- */
(function(){
  const row = $('#modeRow');
  if(!row) return;
  const LABELS = { coder: 'Coder Mode', qna: 'QnA', debug: 'Debug Mode', explain: 'Explain Mode' };
  window.MODE_LABELS = LABELS;
  window.modeLabel = () => LABELS[S.mode] || 'Coder Mode';
  function draw(){
    row.querySelectorAll('.mode-pill').forEach(b => b.classList.toggle('current', b.dataset.mode === S.mode));
  }
  row.addEventListener('click', e => {
    const b = e.target.closest('.mode-pill');
    if(!b || b.dataset.mode === S.mode) return;
    S.mode = b.dataset.mode;
    save();
    draw();
    toast(LABELS[S.mode] + ' on');
  });
  if(!S.mode) S.mode = 'coder';
  draw();
})();""",
"""/* ---------- mode combobox (Coder / QnA) ---------- */
(function(){
  const row = $('#modeRow');
  if(!row) return;
  const LABELS = { coder: 'Coder Mode', qna: 'QnA' };
  const ICONS = { coder: 'i-cpu', qna: 'i-qna' };
  const SUBS = { coder: 'writes & fixes code', qna: 'answers anything' };
  window.MODE_LABELS = LABELS;
  window.modeLabel = () => LABELS[S.mode] || 'Coder Mode';
  const menu = document.createElement('div');
  menu.className = 'mode-menu';
  menu.setAttribute('role', 'listbox');
  ['coder', 'qna'].forEach(id => {
    const o = document.createElement('button');
    o.type = 'button'; o.className = 'mode-opt'; o.dataset.mode = id;
    o.innerHTML = '<svg class="ic small"><use href="#' + ICONS[id] + '"/></svg>' +
      '<span class="ol">' + LABELS[id] + '</span><span class="os">' + SUBS[id] + '</span>';
    menu.append(o);
  });
  row.append(menu);
  function draw(){
    $('#modeCur').textContent = window.modeLabel();
    const use = row.querySelector('.mode-ico use');
    if(use) use.setAttribute('href', '#' + (ICONS[S.mode] || 'i-cpu'));
    menu.querySelectorAll('.mode-opt').forEach(o => o.classList.toggle('current', o.dataset.mode === S.mode));
  }
  $('#modeBtn').onclick = e => { e.stopPropagation(); row.classList.toggle('open'); };
  document.addEventListener('click', e => { if(!row.contains(e.target)) row.classList.remove('open'); });
  menu.addEventListener('click', e => {
    const o = e.target.closest('.mode-opt');
    if(!o) return;
    S.mode = o.dataset.mode;
    save();
    draw();
    row.classList.remove('open');
    toast(LABELS[S.mode] + ' on');
  });
  if(!S.mode) S.mode = 'coder';
  draw();
})();""")

# ---- 5. AI file write helpers (before renderChat) ----
src = rep(src,
"""  return c;
}
function renderChat(){""",
"""  return c;
}
/* ---------- AI file write: save code replies as real files ---------- */
function codeExt(code){
  const c = (code || '').slice(0, 500);
  if(/^\\s*<!doctype html/i.test(c) || /<html[\\s>]/i.test(c)) return 'html';
  if(/^\\s*<svg[\\s>]/i.test(c)) return 'svg';
  if(/^\\s*\\{[\\s\\S]*\\}\\s*$/.test(code || '') && /"[^"]+"\\s*:/.test(c)) return 'json';
  if(/<\\?php/.test(c)) return 'php';
  if(/#include|int\\s+main\\s*\\(/.test(c)) return 'c';
  if(/^\\s*(def |class \\w+|import \\w+|from \\w+ import)/m.test(c) && /:\\s*$/m.test(c)) return 'py';
  if(/^#!\\/bin\\/(ba)?sh/m.test(c) || /^\\s*curl\\s/m.test(c)) return 'sh';
  if(/\\bSELECT\\b[\\s\\S]{0,400}\\bFROM\\b/i.test(c)) return 'sql';
  if(/^\\s*---$/m.test(c) && /^\\s*[\\w-]+:/m.test(c)) return 'yml';
  if(/=>|\\bfunction\\b|\\bconst\\b|\\blet\\b|console\\.\\w+\\(|document\\.\\w+\\(|require\\(/.test(c)) return 'js';
  if(/<\\/?[a-z][\\w-]*[\\s>]/i.test(c)) return 'html';
  return 'txt';
}
function saveCodeFile(code, ext){
  const a = document.createElement('a');
  const blob = new Blob([code], { type: 'text/plain' });
  a.href = URL.createObjectURL(blob);
  a.download = 'xr-code.' + ext;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Saved xr-code.' + ext);
}
function codeBlock(code){
  const ext = codeExt(code);
  const wrap = document.createElement('div'); wrap.className = 'code-wrap';
  const bar = document.createElement('div'); bar.className = 'code-bar';
  const name = document.createElement('span'); name.className = 'code-name'; name.textContent = 'xr-code.' + ext;
  const save = document.createElement('button'); save.className = 'code-save'; save.type = 'button'; save.title = 'Download this file';
  save.innerHTML = '<svg class="ic small"><use href="#i-down"/></svg>save';
  save.onclick = () => saveCodeFile(code, ext);
  bar.append(name, save);
  const pre = document.createElement('pre'); pre.textContent = code;
  wrap.append(bar, pre);
  return wrap;
}
function renderChat(){""")

# ---- 6. wire codeBlock into both render paths ----
src = rep(src,
"""      if(reply.code){
        const pre = document.createElement('pre'); pre.textContent = reply.code; el.append(pre);
      }""",
"""      if(reply.code){
        el.append(codeBlock(reply.code));
      }""")

src = rep(src,
"""  if(m.code){ const pre = document.createElement('pre'); pre.textContent = m.code; w.append(pre); }""",
"""  if(m.code){ w.append(codeBlock(m.code)); }""")

# ---- 7. code bar CSS (after .msg pre rule) ----
src = rep(src,
""".msg pre{
  font-family:var(--font-mono);font-size:12px;line-height:1.6;overflow-x:auto;
  background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:13px 15px;
}""",
""".msg pre{
  font-family:var(--font-mono);font-size:12px;line-height:1.6;overflow-x:auto;
  background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:13px 15px;
}
.code-wrap{display:flex;flex-direction:column;min-width:0}
.code-bar{
  display:flex;align-items:center;gap:8px;padding:7px 8px 7px 13px;
  background:var(--bg2);border:1px solid var(--line);border-bottom:none;border-radius:12px 12px 0 0;
  font-family:var(--font-mono);font-size:10.5px;color:var(--muted);
}
.code-wrap pre{border-radius:0 0 12px 12px}
.code-save{
  display:inline-flex;align-items:center;gap:5px;margin-left:auto;
  font-family:var(--font-mono);font-size:10.5px;color:var(--muted);
  padding:3px 8px;border-radius:7px;transition:color .15s,background .15s;
}
.code-save:hover{color:var(--accent);background:var(--panel)}""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
checks = {'mode-pill': 0, 'mode-btn': 5, 'mode-menu': 3, 'mode-opt': 6, 'mode-box': 4,
          'modeCur': 2, 'mode-ico': 2, 'codeExt': 2, 'codeBlock': 3, 'saveCodeFile': 2,
          'code-wrap': 3, 'code-bar': 3, 'code-save': 3, 'xr-code.': 2}
for k, w in checks.items():
    got = core.count(k)
    assert got == w, f'{k}: {got} != {w}'
assert 'Debug Mode' not in core and 'Explain Mode' not in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — mode combobox (2 modes) + AI file write wired')
