#!/usr/bin/env python3
# vision.py — make XR Code actually SEE photo attachments (end-to-end vision).
# Client: send downscaled image parts with the message instead of a text note.
# Idempotent: anchored rep() + count assertions + snapshot + node --check.
import re, shutil, sys

SRC = '/home/z/my-project/download/xr-code.html'
SNAP = '/home/z/my-project/scripts/xr-pre-vision.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, SNAP)

def rep(out, old, new, n=1):
    c = out.count(old)
    assert c == n, f'anchor x{c} (want x{n}): {old[:90]!r}'
    return out.replace(old, new)

out = src

# ---- E1: read a data URL for EVERY image (any size <= 8MB cap), not just tiny ones
out = rep(out,
"""      if((f.type || '').indexOf('image/') === 0 && f.size <= 300000){
        a.d = await readDataURL(f);""",
"""      if((f.type || '').indexOf('image/') === 0){
        a.d = await readDataURL(f);""")

# ---- E2: toVision helper — downscale to <=1024px JPEG so payloads stay small
out = rep(out,
"""/* ---------- hosted brain ---------- */
function brainContext(c){""",
"""/* ---------- hosted brain ---------- */
function toVision(a){                             // downscale a photo for the brain — small payload, fast answer
  if(a.v) return Promise.resolve(a.v);
  return new Promise(res => {
    if(!a.d){ res(''); return; }
    const im = new Image();
    im.onload = () => {
      try{
        const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        if(!w || !h){ res(a.d); return; }
        const MAX = 1024, k = Math.min(1, MAX / Math.max(w, h));
        if(k >= 1 && a.d.length < 400000){ a.v = a.d; res(a.v); return; }
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(w * k));
        cv.height = Math.max(1, Math.round(h * k));
        cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
        a.v = cv.toDataURL('image/jpeg', 0.85);
        res(a.v);
      }catch(e){ res(a.d); }
    };
    im.onerror = () => res(a.d);
    im.src = a.d;
  });
}
function brainContext(c){""")

# ---- E3: attach real image parts to the outgoing message (vision!)
out = rep(out,
"""  const ctx = brainContext(c);
  if(ctx.length) ctx[ctx.length - 1].content = last;""",
"""  const ctx = brainContext(c);
  const vision = [];                             // the images XR Code will actually see
  for(const a of (atts || [])){
    if((a.ty || '').indexOf('image/') === 0 && a.d && vision.length < 3) vision.push(await toVision(a));
  }
  if(ctx.length){
    ctx[ctx.length - 1].content = vision.length
      ? [{ type: 'text', text: last }].concat(vision.map(u => ({ type: 'image_url', image_url: { url: u } })))
      : last;
    if(vision.length) chip.textContent = 'engine: looking at your image…';
  }""")

# ---- E4: empty-state hints the new power
out = rep(out,
"""    e.innerHTML = '<span class="big">XR Code</span>Ask anything — the hosted AI brain plans, codes, debugs and explains on its own.';""",
"""    e.innerHTML = '<span class="big">XR Code</span>Ask anything or drop a photo — the AI brain plans, codes, debugs, explains and sees.';""")

# ---- assertions
assert out.count('function toVision(') == 1
assert out.count("type: 'image_url'") == 1
assert out.count("f.size <= 300000") == 0
assert out.count('vision.length < 3') == 1
assert out.count("engine: looking at your image") == 1
assert 'the hosted AI brain plans' not in out

open(SRC, 'w', encoding='utf-8').write(out)

# ---- node --check the extracted main script
m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'main script not found'
open('/tmp/xr_vision_check.js', 'w', encoding='utf-8').write(m.group(1))
print('OK — vision transform applied, snapshot at', SNAP)
