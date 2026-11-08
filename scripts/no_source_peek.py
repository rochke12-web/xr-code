#!/usr/bin/env python3
"""XR CODE — block the common 'peek at source' shortcuts inside the app:
Ctrl+U (view-source), Ctrl+S (save page), F12 / Ctrl+Shift+I,J,C (devtools).
Note: this is a deterrent only — devtools can never be fully blocked client-side."""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-nosrc.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

OLD = 'document.addEventListener(\'contextmenu\', e => e.preventDefault());   // right click: no browser menu — native app feel'
NEW = '''document.addEventListener('contextmenu', e => e.preventDefault());   // right click: no browser menu — native app feel
/* block casual "peek at source" shortcuts (deterrent — devtools can never be fully blocked) */
document.addEventListener('keydown', e => {
  const k = (e.key || '').toLowerCase();
  const dev = e.key === 'F12' || (e.ctrlKey && e.shiftKey && (k === 'i' || k === 'j' || k === 'c'));
  const src = (e.ctrlKey || e.metaKey) && !e.shiftKey && (k === 'u' || k === 's');
  if (dev || src){ e.preventDefault(); e.stopPropagation(); toast('Source is protected 🔒'); }
}, true);'''

src = rep(src, OLD, NEW)
open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity (strip base64 payloads first to avoid false positives) ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count("peek at source") == 1
assert core.count("Source is protected") == 1

# ---- JS syntax check on the extracted <script> ----
m = re.search(r'<script>(.*?)</script>', src, re.S)
assert m, 'no <script> block'
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)

print('OK — source-peek shortcuts blocked inside the app')
