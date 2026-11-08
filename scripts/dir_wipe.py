#!/usr/bin/env python3
"""XR CODE — directional theme wipe:
- switching TO LIGHT: radial wipe expands from the theme button (top right)
- switching TO DARK:  radial wipe expands from the bottom-left corner"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-dirwipe.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

OLD = """  if(document.startViewTransition && !reduce){  // radial wipe expanding from the toggle button
    let x = innerWidth / 2, y = 28;
    const btn = document.getElementById('themeQuick');
    if(btn){ const r = btn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;"""
NEW = """  if(document.startViewTransition && !reduce){  // directional radial wipe
    let x, y;                                    // -> light: top right (button) | -> dark: bottom left
    if(th === 'light'){
      x = innerWidth; y = 0;
      const btn = document.getElementById('themeQuick');
      if(btn){ const r = btn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    }else{
      x = 0; y = innerHeight;
    }
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;"""

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

src = rep(src, OLD, NEW)
open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert "if(th === 'light'){" in core and 'x = 0; y = innerHeight;' in core
assert core.count('circle(0px at') == 1  # wipe keyframes intact
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — directional wipe: light from top-right, dark from bottom-left')
