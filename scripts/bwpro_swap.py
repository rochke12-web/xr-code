#!/usr/bin/env python3
"""Swap the <style> block of download/xr-code.html with the new XR MONO STUDIO
stylesheet (scripts/style_a.css + style_b.css + style_c.css), update the font
link, keep everything else byte-identical."""
import re, shutil, sys

ROOT = '/home/z/my-project'
SRC  = f'{ROOT}/download/xr-code.html'
BAK  = f'{ROOT}/scripts/xr-pre-bwpro.html'

css = ''.join(open(f'{ROOT}/scripts/style_{p}.css').read() for p in ('a', 'b', 'c'))

html = open(SRC).read()
shutil.copyfile(SRC, BAK)

# 1. swap the style block
new_html, n = re.subn(r'<style>.*?</style>', lambda m: '<style>\n' + css + '</style>', html, count=1, flags=re.S)
assert n == 1, 'style block not found'

# 2. update the Google Fonts link: Space Grotesk (display) + Inter + JetBrains Mono
new_html = re.sub(
    r'<link href="https://fonts\.googleapis\.com[^"]*" rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">',
    new_html, count=1)
assert 'Space+Grotesk' in new_html, 'font link not updated'

# sanity: JS contract markers must survive
for marker in ('XR-Code', 'big-search', 'data:image', 'id="dsLock"', 'nav-glider',
               'id="homeForm"', 'id="chatForm"', 'id="themeQuick"', 'id="msgs"'):
    assert marker in new_html, 'missing marker ' + marker
assert new_html.count('<script>') == 2, f"script count {new_html.count('<script>')}"

open(SRC, 'w').write(new_html)
print('style swapped:', len(css) // 1024, 'KB css |', len(new_html) // 1024, 'KB html | backup ->', BAK)
