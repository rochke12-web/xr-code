#!/usr/bin/env python3
"""1) Rename app brand XR-Space -> XR-Code (AI stays XR Code).
2) Inject source guard: devtools shortcut block + contextmenu block.
Idempotent, count-checked."""
import re, pathlib, shutil

P = pathlib.Path('/home/z/my-project/download/xr-code.html')
src = P.read_text(encoding='utf-8')
snap = pathlib.Path('/home/z/my-project/scripts/xr-pre-xrcode.html')
if not snap.exists():
    shutil.copyfile(P, snap)

out = src

# --- 1. brand rename ---
out = out.replace('XR <span class="thin">SPACE</span>', 'XR <span class="thin">CODE</span>')
n = out.count('XR-Space')
out = out.replace('XR-Space', 'XR-Code')
assert 'XR-Space' not in out, 'XR-Space residue'
assert out.count('XR-Code') == n, 'count drift'
assert 'XR <span class="thin">CODE</span>' in out, 'hero span not renamed'
# AI name stays exactly 'XR Code' (no dash) on bubbles/chips
assert out.count("who.textContent = 'XR Code';") == 2, 'AI who-labels changed'
assert out.count("who0.textContent = 'XR Code';") == 1, 'AI thinking label changed'
assert out.count("'You' : 'XR Code';") == 1, 'AI ternary label changed'

# --- 2. source guard (only once) ---
GUARD = '''/* ===== SOURCE GUARD — blocks devtools shortcuts + view-source ===== */
(function(){
  if (window.__xrGuard) return; window.__xrGuard = 1;
  var BLOCK = { f12: 1 };
  document.addEventListener('keydown', function(e){
    var k = (e.key || '').toLowerCase();
    if (BLOCK[k] || (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c' || k === 'k')) ||
        (e.ctrlKey && (k === 'u' || k === 's'))) {
      e.preventDefault(); e.stopPropagation();
    }
  }, true);
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); }, true);
})();'''
if 'SOURCE GUARD' not in out:
    anchor = "<script>/* ===== asset + icon hydration"
    assert out.count(anchor) == 1, 'script anchor missing'
    out = out.replace(anchor, '<script>' + GUARD + '\n/* ===== asset + icon hydration')

m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'app script not found'
pathlib.Path('/tmp/_xrcode_check.js').write_text(m.group(1), encoding='utf-8')

P.write_text(out, encoding='utf-8')
print(f'brand: XR-Space -> XR-Code ({n} spots) | hero: XR CODE | guard: injected')
