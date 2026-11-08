#!/usr/bin/env python3
"""XR CODE — search send button: '>' chevron that flips to '<' on click:
- new sprite symbol i-chev (chevron-right) added to the JS sprite string
- home search bar button icon i-send -> i-chev (chat composer keeps paper plane)
- .flip class rotates the icon 180deg (so '>' reads as '<'), removed after 700ms"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-chev.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1) sprite: add chevron-right symbol (inside JS sprite string, quote-free insertion) ----
CHEV = '<symbol id="i-chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></symbol>'
src = rep(src, '<symbol id="i-send" viewBox="0 0 24 24">', CHEV + '<symbol id="i-send" viewBox="0 0 24 24">')

# ---- 2) markup: search bar button uses the chevron (chat composer untouched) ----
src, n = re.subn(r'(<form class="big-search" id="homeForm">.*?)data-ic="i-send"',
                 r'\1data-ic="i-chev"', src, count=1, flags=re.S)
assert n == 1, f'homeForm icon swap x{n}'

# ---- 3) CSS: rotate transition + flipped state ----
src = rep(src, '  .send-btn:active,.theme-quick:active{transform:scale(.94)}',
"""  .send-btn:active,.theme-quick:active{transform:scale(.94)}
  /* search send button: > flips to < on click */
  .send-btn .ic{transition:transform .28s cubic-bezier(.3,.7,.3,1)}
  .send-btn.flip .ic{transform:rotate(180deg)}""")

# ---- 4) JS: click handler adds .flip for 700ms ----
src = rep(src, "$('#homeForm').addEventListener('submit', e => {",
"""/* search send button: '>' flips to '<' on click */
(function(){
  const sb = document.querySelector('#homeForm .send-btn');
  if(!sb) return;
  let sbT = null;
  sb.addEventListener('click', function(){
    sb.classList.add('flip');
    clearTimeout(sbT);
    sbT = setTimeout(function(){ sb.classList.remove('flip'); }, 700);
  });
})();

$('#homeForm').addEventListener('submit', e => {""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
markup = core.split('</style>', 1)[1].split('<script>')[0]
assert markup.count('data-ic="i-chev"') == 1, 'search button must use chevron'
assert markup.count('data-ic="i-send"') == 1, 'chat composer must keep paper plane'
assert markup.find('i-chev') < markup.find('id="chatInput"') or 'chatInput' not in markup
assert core.count('symbol id="i-chev"') == 1
assert core.count('send-btn.flip') == 1 and 'sb.classList' in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — search send button is now a chevron that flips to < on click')
