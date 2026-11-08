#!/usr/bin/env python3
"""XR CODE — plain-HTML refactor (user request):
HTML markup keeps ONLY plain text + elements with class/alt hooks.
- 15 inline <svg><use> icons -> <i class="..." data-ic="name"></i>, swapped to real svg by JS at boot
- hidden SVG sprite (15 symbols) -> moved into the JS section, injected at boot
- 6 base64 <img> (logos, wordmark, hero scenes) -> data-asset="key", src assigned by JS from ASSETS map
- 2 inline style="margin-top:12px" -> CSS rules on .data-row / .note"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-plain.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

def js_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n") + "'"

head, rest = src.split('</style>', 1)
markup, script = rest.split('<script>', 1)

# ---- 1) CSS: absorb the two inline styles (append at end of stylesheet; </style> re-added at assembly) ----
head = head + ('  /* inline styles moved out of HTML */\n'
               '  .data-row{margin-top:12px}\n'
               '  .note{margin-top:12px}\n')

# ---- 2) markup: strip inline margin styles ----
markup = rep(markup, '<div class="data-row" style="margin-top:12px">', '<div class="data-row">')
markup = rep(markup, '<p class="note" style="margin-top:12px">', '<p class="note">')

# ---- 3) markup: icons -> <i data-ic> placeholders ----
markup, n_icons = re.subn(r'<svg class="(ic[^"]*)"><use href="#(i-[a-z-]+)"\s*/></svg>',
                          lambda m: f'<i class="{m.group(1)}" data-ic="{m.group(2)}"></i>', markup)
assert n_icons == 15, f'icons: {n_icons}'

# ---- 4) markup: images -> data-asset keys; keep payloads for the JS map ----
ASSET_KEYS = [
    ('logo-dark',   r'<img class="(logo-img dark-only)" src="(data:image/png;base64,[A-Za-z0-9+/=]+)" (alt="XR CODE logo")>'),
    ('logo-light',  r'<img class="(logo-img light-only)" src="(data:image/png;base64,[A-Za-z0-9+/=]+)" (alt="XR CODE logo")>'),
    ('scene-dark',  r'<img class="(scene dark-only)" src="(data:image/jpeg;base64,[A-Za-z0-9+/=]+)" (alt="")>'),
    ('scene-light', r'<img class="(scene light-only)" src="(data:image/jpeg;base64,[A-Za-z0-9+/=]+)" (alt="")>'),
    ('wordmark',    r'<img class="(bs-logo dark-only)" src="(data:image/png;base64,[A-Za-z0-9+/=]+)" (alt="XR logo" draggable="false")>'),
    ('tile-light',  r'<img class="(bs-logo light-only)" src="(data:image/png;base64,[A-Za-z0-9+/=]+)" (alt="XR logo" draggable="false")>'),
]
payload = {}
for key, pat in ASSET_KEYS:
    def repl(m, key=key):
        payload[key] = m.group(2)
        return f'<img class="{m.group(1)}" data-asset="{key}" {m.group(3)}>'
    markup, n = re.subn(pat, repl, markup)
    assert n == 1, f'{key}: x{n}'

# ---- 5) markup: pull the hidden sprite out ----
m = re.search(r'<svg width="0" height="0" style="position:absolute" aria-hidden="true">.*?</svg>', markup, re.S)
assert m, 'sprite not found'
sprite_html = m.group(0)
markup = markup.replace(sprite_html, '<!-- icon sprite + images hydrate from JS -->')

# ---- 6) JS: prepend hydration block (assets, sprite, icon swap) ----
asset_block = ',\n'.join(f"    '{k}': '{payload[k]}'" for k in payload)
hydrate = ("/* ===== asset + icon hydration (HTML markup stays plain text) ===== */\n"
           "(function(){\n"
           "  const ASSETS = {\n" + asset_block + "\n  };\n"
           "  document.querySelectorAll('img[data-asset]').forEach(function(im){\n"
           "    im.src = ASSETS[im.dataset.asset] || '';\n"
           "  });\n"
           "  document.body.insertAdjacentHTML('afterbegin', " + js_str(sprite_html) + ");\n"
           "  document.querySelectorAll('i[data-ic]').forEach(function(el){\n"
           "    el.outerHTML = '<svg class=\"' + el.className + '\"><use href=\"#' + el.dataset.ic + '\"/></svg>';\n"
           "  });\n"
           "})();\n\n")
script = hydrate + script

src = head + '</style>' + markup + '<script>' + script
open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
markup2 = core.split('</style>', 1)[1].split('<script>')[0]
assert '<svg' not in markup2, 'svg left in markup'
assert 'base64,' not in markup2, 'base64 left in markup'
assert 'style="' not in markup2, 'inline style left in markup'
assert markup2.count('data-ic=') == 15 and markup2.count('data-asset=') == 6
assert 'insertAdjacentHTML' in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — HTML is plain text now; icons/sprite/images hydrate from JS')
