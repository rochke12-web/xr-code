#!/usr/bin/env python3
"""XR CODE — 'best UI' polish pass (fast, GPU-friendly):
- one-shot entrance: hero children staggered rise, scene fade+unzoom, topbar/status slide
- view switch: fade+rise on .view.active (home/chat/settings)
- micro-interactions: nav icon nudge, send/theme press scale, search hover lift, card shadow
- animated sheen on hero title gradient (dark + light scoped)
- smooth scroll, antialiased font rendering, caret color, img decoding=async
- everything inside prefers-reduced-motion: no-preference guard (transform/opacity only)"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-polish.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) CSS polish block (appended at the very end of the stylesheet) ----
POLISH = """  .note{margin-top:12px}

  /* ================= UI polish pass (GPU-friendly) ================= */
  body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
  html{scroll-behavior:smooth}
  .big-search input{caret-color:var(--accent)}
  .big-search{transition:border-color .2s,transform .2s,box-shadow .2s}
  .big-search:hover{transform:translateY(-1px)}
  .st-card:hover{box-shadow:var(--shadow)}
  .nav button .ic{transition:transform .2s cubic-bezier(.3,.7,.3,1)}
  .nav button:hover .ic{transform:translateX(2px)}
  .send-btn:active,.theme-quick:active{transform:scale(.94)}
  .hero h2 .thin,:root[data-theme="light"] .hero h2 .thin{background-size:200% auto}
  @media (prefers-reduced-motion: no-preference){
    @keyframes xr-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
    @keyframes xr-view{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    @keyframes xr-scene{from{opacity:0;transform:scale(1.035)}to{opacity:1;transform:none}}
    @keyframes xr-sheen{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .view.active{animation:xr-view .32s cubic-bezier(.3,.7,.3,1)}
    .scene{animation:xr-scene .9s cubic-bezier(.25,.7,.3,1) both}
    .hero > *:not(.scene){animation:xr-rise .55s cubic-bezier(.2,.7,.2,1) backwards}
    .hero > *:not(.scene):nth-child(3){animation-delay:.06s}
    .hero > *:not(.scene):nth-child(4){animation-delay:.12s}
    .hero > *:not(.scene):nth-child(5){animation-delay:.18s}
    .hero > *:not(.scene):nth-child(6){animation-delay:.24s}
    .hero > *:not(.scene):nth-child(7){animation-delay:.3s}
    .hero h2 .thin,:root[data-theme="light"] .hero h2 .thin{animation:xr-sheen 7s linear infinite}
  }
</style>"""
src = rep(src, '  .note{margin-top:12px}\n</style>', POLISH)

# ---- 2) hydration: decode images async (faster first paint) ----
src = rep(src, "    im.src = ASSETS[im.dataset.asset] || '';",
               "    im.src = ASSETS[im.dataset.asset] || '';\n"
               "    im.decoding = 'async';")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('xr-rise') == 2 and core.count('xr-view') == 2 and core.count('xr-scene') == 2 and core.count('xr-sheen') == 2
assert "im.decoding = 'async'" in core
assert core.count('prefers-reduced-motion: no-preference') == 1
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — UI polish pass installed')
