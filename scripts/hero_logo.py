#!/usr/bin/env python3
"""XR CODE — three changes:
1) remove topbar-RIGHT logo (brand-right keeps badge + theme button)
2) hero 'XR CODE' heading -> transparent wordmark pair (dark: silver transparent; light: new upload, white bg removed)
3) square tile logo loses its pill border/background (bare tile)"""
import base64, io, re, shutil, subprocess
from PIL import Image
import numpy as np

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-herologo.html'

def to_b64(im, height):
    im = im.convert('RGBA')
    im = im.resize((round(im.width * height / im.height), height), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode(), buf.tell(), im.size

# ---- silver transparent wordmark (dark mode) from the earlier upload ----
im = Image.open('/home/z/my-project/upload/pasted_image_1794127215994.png').convert('RGBA')
l, t, r, b = im.getbbox(); pad = 10
im = im.crop((max(0,l-pad), max(0,t-pad), min(im.width,r+pad), min(im.height,b+pad)))
silver, s1, z1 = to_b64(im, 128)

# ---- new upload: white bg -> transparent (min-channel keying) ----
im = Image.open('/home/z/my-project/upload/pasted_image_1794128433637.png').convert('RGB')
a = np.array(im).astype(int)
d = 255 - a.min(axis=2)                       # 0 = white bg, high = dark letters
alpha = np.clip((d - 8) * 4, 0, 255).astype(np.uint8)
rgba = np.dstack([np.array(im), alpha])
im = Image.fromarray(rgba, 'RGBA')
bbox = im.getbbox(); pad = 12
im = im.crop((max(0,bbox[0]-pad), max(0,bbox[1]-pad), min(im.width,bbox[2]+pad), min(im.height,bbox[3]+pad)))
light, s2, z2 = to_b64(im, 128)
print(f'silver wordmark {z1} {s1/1024:.0f}KB | light wordmark {z2} {s2/1024:.0f}KB')

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) remove topbar-right logo (the one after the theme button) ----
src, n1 = re.subn(r'(</button>)\n\s*<div class="logo"><img class="logo-img dark-only".*?</div>', r'\1', src, flags=re.S)
assert n1 == 1, f'right logo removals: {n1}'

# ---- 2) hero heading -> wordmark pair ----
src = rep(src, '<h2>XR <span class="thin">CODE</span></h2>',
    '<img class="hero-word dark-only" src="data:image/png;base64,' + silver + '" alt="XR CODE" draggable="false">'
    '<img class="hero-word light-only" src="data:image/png;base64,' + light + '" alt="XR CODE" draggable="false">')

# ---- 3) square tile: strip pill chrome (border/bg/shadow/padding) ----
src = rep(src, '.logo{padding:3px;background:var(--bg2)}', '')
big = re.search(r'\.logo\{(?:[^}])*display:grid;place-items:center;(?:[^}]*)\}', src)
assert big, 'big .logo rule not found'
src = rep(src, big.group(0), '.logo{width:36px;height:36px;flex:none;display:grid;place-items:center;line-height:0}')

# ---- 4) hero word CSS + extend theme toggles ----
src = rep(src, '.hero h2{',
    '.hero-word{height:clamp(38px,4.6vw,58px);width:auto;display:block;margin:0 auto}'
    '.hero h2{', 1)
src = rep(src, '.logo-img.light-only,.bs-logo.light-only{display:none!important}',
               '.logo-img.light-only,.bs-logo.light-only,.hero-word.light-only{display:none!important}')
src = rep(src, ':root[data-theme="light"] .logo-img.light-only,:root[data-theme="light"] .bs-logo.light-only{display:block!important}',
               ':root[data-theme="light"] .logo-img.light-only,:root[data-theme="light"] .bs-logo.light-only,.hero-word.light-only{display:block!important}')
src = rep(src, ':root[data-theme="light"] .logo-img.dark-only,:root[data-theme="light"] .bs-logo.dark-only{display:none!important}',
               ':root[data-theme="light"] .logo-img.dark-only,:root[data-theme="light"] .bs-logo.dark-only,.hero-word.dark-only{display:none!important}')

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('hero-word dark-only') == 1 and core.count('hero-word light-only') == 1
assert core.count('<div class="logo">') == 1, 'only left logo should remain'
assert '.logo{padding:3px' not in core and 'inset 0 1px 0 var(--line-soft)}' not in core.split('.statusbar')[0].split('.logo')[1][:400]
assert core.count('hero-word{height:clamp') == 1
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — right logo removed, hero wordmark pair live, tile borderless')
