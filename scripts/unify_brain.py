#!/usr/bin/env python3
"""Remove the 4-mode system -> one unified brain (idempotent, count-checked).
Client: no mode picker UI, no S.mode, no mode in POST body; chips simplified.
"""
import re, pathlib, shutil

P = pathlib.Path('/home/z/my-project/download/xr-code.html')
src = P.read_text(encoding='utf-8')
snap = pathlib.Path('/home/z/my-project/scripts/xr-pre-unify.html')
if not snap.exists():
    shutil.copyfile(P, snap)

def rep(s, old, new, n=1):
    assert s.count(old) == n, f'anchor x{s.count(old)} (want {n}): {old[:70]!r}'
    return s.replace(old, new)

out = src

# 1. hero markup: drop the whole mode-box
out = rep(out, '''        <div class="mode-box" id="modeRow">
          <button class="mode-btn" id="modeBtn" type="button" title="Choose mode">
            <i class="ic small mode-ico" data-ic="i-cpu"></i>
            <span id="modeCur">Coder Mode</span>
            <i class="ic small mchev" data-ic="i-down"></i>
          </button>
        </div>
''', '')

# 2. CSS: mode picker styles + transitions
out = rep(out, '''.mode-box{position:relative;display:flex;justify-content:center}
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
.mode-opt .os{margin-left:auto;font-family:var(--font-mono);font-size:10px;color:var(--muted)}
''', '')
out = rep(out, '''    .mode-menu{transition:opacity .22s ease,transform .32s cubic-bezier(.3,1.25,.35,1)}
    .mode-btn .mchev{transition:transform .3s cubic-bezier(.3,.7,.3,1)}
''', '')

# 3. state: no mode key, migrate old payloads away
out = rep(out, "    theme: 'dark',\n    mode: 'coder',           // Coder | QnA | Debug | Explain\n    user: null,",
              "    theme: 'dark',\n    user: null,")
out = rep(out, "  delete S.startupDone; delete S.gemini; delete S.local;    // leftovers from old versions",
              "  delete S.startupDone; delete S.gemini; delete S.local;    // leftovers from old versions\n  delete S.mode;                                           // mode picker removed — one unified brain")

# 4. chips + POST body: no mode anywhere
out = rep(out, "  chip.textContent = 'engine: ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode') + ' · thinking…';",
              "  chip.textContent = 'engine: thinking…';")
out = rep(out, "    body: JSON.stringify({ messages: ctx, mode: S.mode || 'coder' })",
              "    body: JSON.stringify({ messages: ctx })")
out = rep(out, "    chip.textContent = 'engine: live · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');",
              "    chip.textContent = 'engine: live';")
out = rep(out, "  chip.textContent = 'engine: XR-Space AI · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');",
              "  chip.textContent = 'engine: XR-Space AI';")

# 5. drop the mode combobox IIFE (anchored to the section that follows)
iife_start = out.index('/* ---------- mode combobox (Coder / QnA) ---------- */')
iife_end = out.index('/* ---------- file attach (paperclip right of send) ---------- */')
block = out[iife_start:iife_end]
assert 'window.modeLabel' in block and '})();' in block and len(block) < 2000, 'IIFE block looks wrong'
out = out[:iife_start] + out[iife_end:]

# sanity
for gone in ('modeRow', 'modeBtn', 'mode-opt', 'modeLabel', 'MODE_LABELS',
             'mode-box', 'mode-menu', "mode: S.mode", 'Choose mode', 'Coder Mode'):
    assert gone not in out, f'residue: {gone}'
assert len(re.findall(r'S\.mode\b', out)) == 1, 'S.mode must appear only as delete S.mode;'
assert out.count("'engine: thinking…'") == 1
assert out.count('JSON.stringify({ messages: ctx })') == 1
assert out.count('delete S.mode;') == 1
assert out.count('#i-qna') <= 1  # at most the unused sprite symbol

m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'app script not found'
pathlib.Path('/tmp/_unify_check.js').write_text(m.group(1), encoding='utf-8')

P.write_text(out, encoding='utf-8')
print('unified: mode system fully removed,', len(src) - len(out), 'bytes lighter')
