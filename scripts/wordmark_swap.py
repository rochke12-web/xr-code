#!/usr/bin/env python3
"""XR CODE — swap the old dark-tile logo for the new silver 'XR Code' wordmark.
- New image: upload/pasted_image_1794127215994.png (1062x593, transparent bg, silver lettering)
- Replaced in: topbar x2 (.logo-img) + home search bar (.bs-logo); favicon/tab icon keep the old tile
- .logo pill widens to fit the wordmark; light theme gets filter:invert(1) for readability"""
import base64, io, re, shutil, subprocess
from PIL import Image

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-wordmark.html'
IMG = '/home/z/my-project/upload/pasted_image_1794127215994.png'

# ---- 1) prepare image: trim to lettering bbox + padding, retina height 72px ----
im = Image.open(IMG).convert('RGBA')
bbox = im.getbbox()  # opaque bounds
pad = 10
l, t, r, b = bbox
l, t = max(0, l - pad), max(0, t - pad)
r, b = min(im.width, r + pad), min(im.height, b + pad)
im = im.crop((l, t, r, b))
h = 72
im = im.resize((round(im.width * h / im.height), h), Image.LANCZOS)
buf = io.BytesIO()
im.save(buf, 'PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
print(f'trimmed wordmark: {im.size}, png {buf.tell()/1024:.1f} KB')

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 2) swap the three data-URIs (favicon untouched) ----
src, n1 = re.subn(r'(<img class="logo-img" src="data:image/png;base64,)[A-Za-z0-9+/=]+(")',
                  lambda m: m.group(1) + b64 + m.group(2), src)
assert n1 == 2, f'logo-img swaps: {n1}'
src, n2 = re.subn(r'(<img class="bs-logo" src="data:image/png;base64,)[A-Za-z0-9+/=]+(")',
                  lambda m: m.group(1) + b64 + m.group(2), src)
assert n2 == 1, f'bs-logo swaps: {n2}'

# ---- 3) CSS: pill widens, img contains, light theme inverts ----
src = rep(src,
    'width:36px;height:36px;flex:none;display:grid;place-items:center;',
    'width:auto;height:36px;flex:none;display:grid;place-items:center;')
src = rep(src,
    '.logo .logo-img{width:100%;height:100%;object-fit:cover;display:block;border-radius:9px}',
    '.logo .logo-img{width:auto;height:100%;object-fit:contain;display:block;border-radius:6px}')
src = rep(src,
    ':root[data-theme="light"] .hero h2 .thin{',
    ':root[data-theme="light"] .logo .logo-img,:root[data-theme="light"] .big-search .bs-logo{filter:invert(1)}:root[data-theme="light"] .hero h2 .thin{')

open(SRC, 'w', encoding='utf-8').write(src)

# ---- 4) sanity + JS syntax check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('filter:invert(1)}:root[data-theme="light"] .hero h2 .thin') == 1
assert 'width:100%;height:100%;object-fit:cover' not in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
assert m, 'no <script> block'
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — wordmark swapped in topbar x2 + search bar; light theme inverted')
