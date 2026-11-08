#!/usr/bin/env python3
"""XR CODE — theme-aware tile logo pair (user-provided):
- dark mode  -> upload/XR-modified.png (dark rounded tile, silver XR)
- light mode -> upload/white.png, ROUNDED to match the dark tile (radius 15.6% = 122/784)
- topbar pills: fixed 36x36 again, imgs fill (cover); search bar: silver wordmark (dark) / white tile (light)
- invert(1) light hack removed — real assets now."""
import base64, io, re, shutil, subprocess
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-tiles.html'

def prep(im, size=96, radius_ratio=0.0):
    im = im.convert('RGBA').resize((size, size), Image.LANCZOS)
    if radius_ratio > 0:
        ss = 4  # supersample for smooth corners
        mask = Image.new('L', (size*ss, size*ss), 0)
        d = ImageDraw.Draw(mask)
        d.rounded_rectangle([0, 0, size*ss-1, size*ss-1], radius=int(size*ss*radius_ratio), fill=255)
        mask = mask.resize((size, size), Image.LANCZOS)
        im.putalpha(mask)
    buf = io.BytesIO()
    im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), buf.tell()

dark_b64, s1 = prep(Image.open('/home/z/my-project/upload/XR-modified.png'))
white_b64, s2 = prep(Image.open('/home/z/my-project/upload/white.png'), radius_ratio=122/784)
print(f'dark tile 96px: {s1/1024:.1f} KB | white tile rounded: {s2/1024:.1f} KB')

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) topbar: one img -> dark-only + light-only pair ----
src, n1 = re.subn(
    r'<img class="logo-img" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="XR CODE logo">',
    '<img class="logo-img dark-only" src="data:image/png;base64,' + dark_b64 + '" alt="XR CODE logo">'
    '<img class="logo-img light-only" src="data:image/png;base64,' + white_b64 + '" alt="XR CODE logo">',
    src)
assert n1 == 2, f'topbar pairs: {n1}'

# ---- 2) search bar: wordmark stays for dark, white tile added for light ----
wordmark = re.search(r'<img class="bs-logo" src="(data:image/png;base64,[A-Za-z0-9+/=]+)" alt="XR logo" draggable="false">', src)
assert wordmark, 'bs-logo not found'
bs_pair = ('<img class="bs-logo dark-only" src="' + wordmark.group(1) + '" alt="XR logo" draggable="false">'
           '<img class="bs-logo light-only" src="data:image/png;base64,' + white_b64 + '" alt="XR logo" draggable="false">')
src = rep(src, wordmark.group(0), bs_pair)

# ---- 3) CSS: pill back to 36x36, imgs fill it, theme variant display rules ----
src = rep(src, 'width:auto;height:36px;flex:none;display:grid;place-items:center;',
               'width:36px;height:36px;flex:none;display:grid;place-items:center;')
src = rep(src, '.logo .logo-img{width:auto;height:28px;object-fit:contain;display:block;border-radius:6px}',
               '.logo .logo-img{width:100%;height:100%;object-fit:cover;display:block;border-radius:9px}'
               '.logo-img.light-only,.bs-logo.light-only{display:none}'
               ':root[data-theme="light"] .logo-img.light-only,:root[data-theme="light"] .bs-logo.light-only{display:block}'
               ':root[data-theme="light"] .logo-img.dark-only,:root[data-theme="light"] .bs-logo.dark-only{display:none}')

# ---- 4) drop the invert hack ----
src = rep(src, ':root[data-theme="light"] .logo .logo-img,:root[data-theme="light"] .big-search .bs-logo{filter:invert(1)}', '')

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('logo-img dark-only') == 2 and core.count('logo-img light-only') == 2
assert core.count('bs-logo dark-only') == 1 and core.count('bs-logo light-only') == 1
assert 'filter:invert(1)' not in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — theme tile pair installed (white tile rounded like dark)')
