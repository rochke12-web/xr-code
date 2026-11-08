#!/usr/bin/env python3
"""XR CODE — swap control order in both input bars:
- attach (paperclip) button on the LEFT, send button on the RIGHT
- chat composer:  [paperclip] [input] [send]
- home search:    [logo] [paperclip] [input] [send-chevron]"""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-btnorder.html'

src = open(SRC, encoding='utf-8').read()
if """<button class="file-btn" id="fileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>
        <input id="chatInput\"""" in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. chat composer: file left, send right ----
src = rep(src,
"""<input id="chatInput" autocomplete="off" placeholder="Message XR CODE...">
        <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>
        <button class="file-btn" id="fileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>""",
"""<button class="file-btn" id="fileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>
        <input id="chatInput" autocomplete="off" placeholder="Message XR CODE...">
        <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-send"></i></button>""")

# ---- 2. home search: file after logo (left), send stays rightmost ----
src = rep(src,
"""<input id="homeInput" autocomplete="off" placeholder="What would you like to do with XR CODE?">
          <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>
          <button class="file-btn" id="homeFileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>""",
"""<button class="file-btn" id="homeFileBtn" type="button" title="Attach files"><i class="ic" data-ic="i-clip"></i></button>
          <input id="homeInput" autocomplete="off" placeholder="What would you like to do with XR CODE?">
          <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity: DOM order in both forms ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
ci = core.find('<form class="composer"')
cseg = core[ci:ci + 400]
assert cseg.find('id="fileBtn"') < cseg.find('id="chatInput"') < cseg.find('send-btn'), 'chat order wrong'
hi = core.find('<form class="big-search"')
hseg = core[hi:hi + 800]
assert hseg.find('id="homeFileBtn"') < hseg.find('id="homeInput"') < hseg.find('send-btn'), 'home order wrong'
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — file button left, send button right (chat + home)')
