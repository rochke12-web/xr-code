#!/usr/bin/env python3
"""XR CODE — revert hero to styled text; chat box shows only 'XR' (cropped from the wordmarks):
- hero-word imgs -> back to <h2>XR <span class="thin">CODE</span></h2>, hero-word CSS removed
- bs-logo pair -> silver 'XR' glyphs (dark) / dark 'XR' glyphs (light), both transparent, borderless"""
import base64, io, re, shutil, subprocess
from PIL import Image
import numpy as np

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-xrbox.html'

def xr_crop(im, tag):
    """trim -> cut at the first big gap after the 'XR' glyphs -> trim -> b64 at 64px height"""
    im = im.convert('RGBA')
    a = np.array(im)
    ink = a[..., 3] > 40
    ys, xs = np.where(ink); pad = 10
    l, t, r_, b_ = xs.min(), ys.min(), xs.max(), ys.max()
    im = im.crop((max(0, l-pad), max(0, t-pad), min(im.width, r_+1+pad), min(im.height, b_+1+pad)))
    a = np.array(im)
    col = (a[..., 3] > 40).sum(axis=0)
    w = im.width
    thr = max(1, int(col.max() * 0.02))
    cut = None
    run = 0
    for x in range(int(w * 0.22), w):
        run = run + 1 if col[x] <= thr else 0
        if run >= max(4, int(w * 0.03)):
            cut = x - run + 1
            break
    assert cut, f'{tag}: gap after XR not found'
    print(f'{tag}: XR cut at {cut}/{w} = {cut/w:.2f}')
    im = im.crop((0, 0, cut, im.height))
    a = np.array(im); ys, xs = np.where(a[..., 3] > 40)
    im = im.crop((max(0, xs.min()-8), max(0, ys.min()-8), min(im.width, xs.max()+1+8), min(im.height, ys.max()+1+8)))
    im = im.resize((round(im.width * 64 / im.height), 64), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), buf.tell()

# silver XR (dark mode) from the transparent silver wordmark
silver, s1 = xr_crop(Image.open('/home/z/my-project/upload/pasted_image_1794127215994.png'), 'silver')
# dark XR (light mode) from the new upload, white bg keyed out
im = Image.open('/home/z/my-project/upload/pasted_image_1794128433637.png').convert('RGB')
arr = np.array(im).astype(int)
alpha = np.clip(((255 - arr.min(axis=2)) - 8) * 4, 0, 255).astype(np.uint8)
keyed = Image.fromarray(np.dstack([np.array(im), alpha]))
light, s2 = xr_crop(keyed, 'light')
print(f'silver XR {s1/1024:.1f}KB | light XR {s2/1024:.1f}KB')

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) hero back to styled text ----
src, n1 = re.subn(
    r'<img class="hero-word dark-only"[^>]*><img class="hero-word light-only"[^>]*>',
    '<h2>XR <span class="thin">CODE</span></h2>', src)
assert n1 == 1, f'hero revert: {n1}'

# ---- 2) chat box (search bar) -> XR glyph pair ----
src, n2 = re.subn(r'<img class="bs-logo dark-only" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="XR logo" draggable="false">',
                  '<img class="bs-logo dark-only" src="data:image/png;base64,' + silver + '" alt="XR logo" draggable="false">', src)
assert n2 == 1, f'bs dark: {n2}'
src, n3 = re.subn(r'<img class="bs-logo light-only" src="data:image/png;base64,[A-Za-z0-9+/=]+" alt="XR logo" draggable="false">',
                  '<img class="bs-logo light-only" src="data:image/png;base64,' + light + '" alt="XR logo" draggable="false">', src)
assert n3 == 1, f'bs light: {n3}'

# ---- 3) drop hero-word CSS ----
src = rep(src, '.hero-word{height:clamp(38px,4.6vw,58px);width:auto;display:block;margin:0 auto}', '')
src = rep(src, '.logo-img.light-only,.bs-logo.light-only,.hero-word.light-only{display:none!important}',
               '.logo-img.light-only,.bs-logo.light-only{display:none!important}')
src = rep(src, ':root[data-theme="light"] .logo-img.light-only,:root[data-theme="light"] .bs-logo.light-only,.hero-word.light-only{display:block!important}',
               ':root[data-theme="light"] .logo-img.light-only,:root[data-theme="light"] .bs-logo.light-only{display:block!important}')
src = rep(src, ':root[data-theme="light"] .logo-img.dark-only,:root[data-theme="light"] .bs-logo.dark-only,.hero-word.dark-only{display:none!important}',
               ':root[data-theme="light"] .logo-img.dark-only,:root[data-theme="light"] .bs-logo.dark-only{display:none!important}')

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('<h2>XR <span class="thin">CODE</span></h2>') == 1
assert 'hero-word' not in core
assert core.count('bs-logo dark-only') == 1 and core.count('bs-logo light-only') == 1
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — hero text restored, chat box shows XR glyphs only')
