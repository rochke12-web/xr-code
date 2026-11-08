#!/usr/bin/env python3
"""XR CODE — 4 modes replace 'XR CODE · Version 1.0.0' under the search bar:
- Coder Mode | QnA | Debug Mode | Explain Mode (pill selector, persisted)
- selected mode is sent with every /api/chat call; backend picks the system prompt
- chat header chip shows the active mode"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-modes.html'

src = open(SRC, encoding='utf-8').read()
if 'modeRow' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. sprite: qna / bug / book icons ----
src = rep(src,
    '\\n  <symbol id="i-chev"',
    '\\n  <symbol id="i-qna" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>'
    '\\n  <symbol id="i-bug" viewBox="0 0 24 24"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></symbol>'
    '\\n  <symbol id="i-book" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></symbol>'
    '\\n  <symbol id="i-chev"')

# ---- 2. markup: version line -> mode row ----
src = rep(src,
"""<span class="ver">XR CODE &middot; <b>Version 1.0.0</b></span>""",
"""<div class="mode-row" id="modeRow">
          <button class="mode-pill" type="button" data-mode="coder"><i class="ic small" data-ic="i-cpu"></i> Coder Mode</button>
          <button class="mode-pill" type="button" data-mode="qna"><i class="ic small" data-ic="i-qna"></i> QnA</button>
          <button class="mode-pill" type="button" data-mode="debug"><i class="ic small" data-ic="i-bug"></i> Debug Mode</button>
          <button class="mode-pill" type="button" data-mode="explain"><i class="ic small" data-ic="i-book"></i> Explain Mode</button>
        </div>""")

# ---- 3. CSS: pill styles (next to the old .ver rule) ----
src = rep(src,
""".ver{font-family:var(--font-mono);font-size:11px;color:var(--muted);letter-spacing:.12em}""",
""".ver{font-family:var(--font-mono);font-size:11px;color:var(--muted);letter-spacing:.12em}
.mode-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.mode-pill{
  display:inline-flex;align-items:center;gap:7px;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.06em;color:var(--muted);
  border:1px solid var(--line);border-radius:999px;padding:7px 14px;background:var(--panel);
  transition:color .18s,border-color .18s,background .18s;
}
.mode-pill:hover{color:var(--text);border-color:var(--accent-2)}
.mode-pill.current{color:var(--accent-ink);background:linear-gradient(135deg,var(--accent),var(--accent-2));border-color:transparent;font-weight:600}""")

# ---- 4. motion: pill pop on select ----
src = rep(src,
"""    .att-chip{animation:xr-chipin .28s cubic-bezier(.3,.7,.3,1) backwards}
    @keyframes xr-chipin{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}""",
"""    .att-chip{animation:xr-chipin .28s cubic-bezier(.3,.7,.3,1) backwards}
    @keyframes xr-chipin{from{opacity:0;transform:translateY(6px) scale(.92)}to{opacity:1;transform:none}}
    .mode-pill .ic{transition:transform .3s cubic-bezier(.3,.7,.3,1)}
    @keyframes xr-modepop{0%{transform:scale(.92)}55%{transform:scale(1.06)}100%{transform:scale(1)}}
    .mode-pill.current{animation:xr-modepop .32s cubic-bezier(.3,.7,.3,1)}""")

# ---- 5. state: default mode ----
src = rep(src,
"""  return {
    theme: 'dark',
    user: null,              // optional Discord link — only marks chats as synced""",
"""  return {
    theme: 'dark',
    mode: 'coder',           // Coder | QnA | Debug | Explain
    user: null,              // optional Discord link — only marks chats as synced""")

# ---- 6. modes controller ----
src = rep(src,
"""$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });

/* ---------- file attach (paperclip right of send) ---------- */""",
"""$('#chatForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#chatInput').value); $('#chatInput').value = ''; });

/* ---------- modes (Coder / QnA / Debug / Explain) ---------- */
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
})();

/* ---------- file attach (paperclip right of send) ---------- */""")

# ---- 7. askBrain: send the active mode + show it in the chip ----
src = rep(src,
"""    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: ctx })
    });""",
"""    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: ctx, mode: S.mode || 'coder' })
    });""")

src = rep(src,
"""  const chip = $('#chatModelChip');
  chip.textContent = 'engine: live · thinking…';""",
"""  const chip = $('#chatModelChip');
  chip.textContent = 'engine: ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode') + ' · thinking…';""")

src = rep(src,
"""    chip.textContent = 'engine: live';
    NET.live = true; renderStatus();""",
"""    chip.textContent = 'engine: live · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    NET.live = true; renderStatus();""")

src = rep(src,
"""    chip.textContent = 'engine: XR CODE AI';
    if(!API_BASE){""",
"""    chip.textContent = 'engine: XR CODE AI · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    if(!API_BASE){""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('mode-pill') == 11, core.count('mode-pill')     # 4 markup + 5 css + 2 js
assert core.count('data-mode') == 4, core.count('data-mode')      # markup hooks (JS uses dataset.mode)
assert core.count('dataset.mode') == 3
assert core.count('i-qna') == 2 and core.count('i-bug') == 2 and core.count('i-book') == 2
assert core.count('modeRow') == 2
assert core.count('MODE_LABELS') == 1 and core.count('modeLabel') == 7, (core.count('MODE_LABELS'), core.count('modeLabel'))
assert core.count("mode: S.mode || 'coder'") == 1
assert core.count("mode: 'coder',") == 1                          # defaults()
assert core.count('engine: live · ') == 1
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — 4 modes wired (pills, persistence, API mode, chip label)')
