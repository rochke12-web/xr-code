#!/usr/bin/env python3
"""XR CODE — theme switch animation:
- View Transitions API radial wipe expanding from the top-right theme button (Chromium/Safari)
- universal color cross-fade fallback (.theme-fade) for browsers without startViewTransition
- micro spin on the button icon while pressed; honors prefers-reduced-motion"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-themeanim.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) CSS: view-transition wipe rules + cross-fade fallback + icon micro-spin ----
CSS_ANCHOR = ':root[data-theme="light"] .theme-quick .ic-sun{display:none}'
CSS_NEW = CSS_ANCHOR + """
/* ---------- theme switch animation (radial wipe + cross-fade fallback) ---------- */
::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}
::view-transition-old(root){z-index:1}
::view-transition-new(root){z-index:2}
html.theme-fade,html.theme-fade body,html.theme-fade *,html.theme-fade *::before,html.theme-fade *::after{transition:background .55s ease,background-color .55s ease,color .55s ease,border-color .55s ease,box-shadow .55s ease,fill .55s ease,stroke .55s ease !important}
.theme-quick .ic{transition:transform .5s cubic-bezier(.45,0,.2,1)}
.theme-quick:active .ic{transform:rotate(-120deg) scale(.82)}"""
src = rep(src, CSS_ANCHOR, CSS_NEW)

# ---- 2) JS: animated setTheme (radial wipe -> fallback cross-fade) ----
JS_OLD = "function setTheme(th){ S.theme = th; save(); applyTheme(); toast(th === 'dark' ? 'Dark mode on' : 'Light mode on'); }"
JS_NEW = """function setTheme(th){
  if(th === S.theme) return;                     // same theme -> nothing to animate
  const rootEl = document.documentElement;
  S.theme = th; save();
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(document.startViewTransition && !reduce){  // radial wipe expanding from the toggle button
    let x = innerWidth / 2, y = 28;
    const btn = document.getElementById('themeQuick');
    if(btn){ const r = btn.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
    const vt = document.startViewTransition(applyTheme);
    vt.ready.then(() => {
      rootEl.animate(
        { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 650, easing: 'cubic-bezier(.45,0,.2,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  }else{                                         // fallback: smooth whole-page color cross-fade
    rootEl.classList.add('theme-fade');
    applyTheme();
    setTimeout(() => rootEl.classList.remove('theme-fade'), 680);
  }
  toast(th === 'dark' ? 'Dark mode on' : 'Light mode on');
}"""
src = rep(src, JS_OLD, JS_NEW)

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS syntax check (strip base64 first) ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('view-transition-old(root)') == 2 and core.count('view-transition-new(root)') == 3
assert core.count('theme-fade') >= 4
assert core.count('document.startViewTransition') == 2
assert 'rootEl.startViewTransition' not in core
assert 'function setTheme(th){ S.theme = th; save();' not in core
assert "::view-transition-new(root)'" in core  # animate pseudoElement target
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — theme switch animation installed (radial wipe + fallback)')
