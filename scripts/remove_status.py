#!/usr/bin/env python3
"""Remove the bottom status bar (AI online / version / Made by).
Idempotent, count-checked. renderStatus gets a null guard (it runs on every save)."""
import re, pathlib, shutil

P = pathlib.Path('/home/z/my-project/download/xr-code.html')
src = P.read_text(encoding='utf-8')
snap = pathlib.Path('/home/z/my-project/scripts/xr-pre-status.html')
if not snap.exists():
    shutil.copyfile(P, snap)

def rep(s, old, new, n=1):
    assert s.count(old) == n, f'anchor x{s.count(old)} (want {n}): {old[:70]!r}'
    return s.replace(old, new)

out = src

# 1. markup: footer + its comment
rep_start = out.index('<!-- ============ STATUS BAR ============ -->')
rep_end = out.index('<div class="toasts" id="toasts"></div>')
block = out[rep_start:rep_end]
assert 'statusbar' in block and 'Made by' in block and len(block) < 600, 'footer block looks wrong'
out = out[:rep_start] + out[rep_end:]

# 2. CSS block
out = rep(out, '''/* ============================================================
   STATUS BAR
   ============================================================ */
.statusbar{
  display:flex;align-items:center;justify-content:space-between;gap:14px;
  padding:7px 20px;border-top:1px solid var(--line);
  font-family:var(--font-mono);font-size:11px;color:var(--muted);
  background:var(--panel);backdrop-filter:blur(12px);
}
.statusbar .dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--line);margin-right:7px}
.statusbar .dot.on{background:var(--ok);box-shadow:0 0 8px var(--ok)}
.statusbar b{color:var(--text);font-weight:600}

''', '')

# 3. toasts were offset above the bar -> sit at the edge now
out = rep(out, '.toasts{position:fixed;right:18px;bottom:52px;', '.toasts{position:fixed;right:18px;bottom:18px;')

# 4. renderStatus: bar gone -> clean no-op (called from save() on every write)
out = rep(out, '''function renderStatus(){
  const el = $('#stConn');
  el.innerHTML = '';
  const d = document.createElement('span'); d.className = 'dot' + (NET.live ? ' on' : '');
  const txt = !NET.checked ? 'AI brain connecting…'
            : NET.live     ? 'AI online — hosted brain'
                           : 'AI offline';
  el.append(d, document.createTextNode(txt));
}''', '''function renderStatus(){                    // status bar removed — safe no-op
  const el = $('#stConn');
  if(!el) return;
}''')

# sanity
assert 'statusbar' not in out, 'statusbar residue'
assert out.count('#stConn') == 1, 'stConn refs'
assert 'Made by <b>' not in out and 'AI online' not in out
assert out.count('status bar removed — safe no-op') == 1

m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'app script not found'
pathlib.Path('/tmp/_status_check.js').write_text(m.group(1), encoding='utf-8')

P.write_text(out, encoding='utf-8')
print('status bar removed, renderStatus guarded, toasts repositioned')
