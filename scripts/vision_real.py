#!/usr/bin/env python3
"""Real vision for XR-Code: photos & videos actually reach the brain.

Client (download/xr-code.html):
  1. i-chev symbol (pure down chevron) replaces the download-looking icon in
     the two model pills (Export keeps the real download icon).
  2. Images are downscaled client-side and attached as REAL image blocks.
  3. Videos are sampled into 4 keyframes (canvas) attached as image blocks.
  4. askBrain builds Anthropic-style multipart content for the last message.
  5. The server's vision description is stored on the user message so
     follow-up turns still know what was in the photo/video.
Server (route.ts, separate edit): describes image blocks via ZAI createVision
and feeds the text to the owner gateway brain.
"""
import re, sys, shutil

SRC = 'download/xr-code.html'
BAK = 'scripts/xr-pre-realvision.html'

src = open(SRC, encoding='utf-8').read()
shutil.copy(SRC, BAK)

edits = []

# 1) i-chev symbol next to i-down
edits.append((
 '<symbol id="i-down" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>',
 '<symbol id="i-down" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></symbol>\n  <symbol id="i-chev" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></symbol>'
))

# 2) pills use the chevron (2 occurrences — replace_all via count check)
n = src.count('<span class="mp-n">Flash</span><i class="ic small" data-ic="i-down"></i>')
assert n == 2, f'pill icon count {n} != 2'
edits.append((
 '<span class="mp-n">Flash</span><i class="ic small" data-ic="i-down"></i>',
 '<span class="mp-n">Flash</span><i class="ic small" data-ic="i-chev"></i>'
))

# 3) CSS: chevron rotates when its menu is open
edits.append((
 '.big-search .model-pill{height:44px}',
 '.big-search .model-pill{height:44px}\n'
 '.model-pill .ic[data-ic="i-chev"]{display:inline-block;transition:transform .18s ease}\n'
 '.mwrap:has(.mmenu.open) .model-pill .ic[data-ic="i-chev"]{transform:rotate(180deg)}'
))

# 4) vision helpers before addFiles
helpers = '''  // ---------- real vision: shrink photos, sample video keyframes ----------
  async function shrinkImage(f){
    const url = await readDataURL(f);
    const img = await new Promise(res => {
      const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = url;
    });
    try{
      if(!img || !img.naturalWidth) return { d: url, mt: 'image/jpeg', b64: String(url).split(',')[1] || '' };
      const MAXP = 1568;
      const sc = Math.min(1, MAXP / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * sc)), h = Math.max(1, Math.round(img.naturalHeight * sc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      const d = cv.toDataURL('image/jpeg', 0.85);
      return { d: d, mt: 'image/jpeg', b64: d.split(',')[1] || '' };
    }catch(e){ return { d: url, mt: 'image/jpeg', b64: String(url).split(',')[1] || '' }; }
  }
  async function videoFrames(f){
    const url = URL.createObjectURL(f);
    const v = document.createElement('video');
    v.muted = true; v.preload = 'data'; v.src = url;
    const frames = [];
    try{
      await new Promise((res, rej) => {
        v.onloadeddata = res; v.onerror = rej; setTimeout(() => rej(new Error('timeout')), 9000);
      });
      const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : 3;
      const times = dur >= 4 ? [dur * 0.08, dur * 0.3, dur * 0.55, dur * 0.8]
                             : [Math.min(0.3, dur / 2), dur * 0.4, dur * 0.65, Math.max(0.1, dur - 0.15)];
      const cv = document.createElement('canvas');
      for(const t of times){
        await new Promise(res => {
          v.onseeked = res;
          try{ v.currentTime = Math.min(Math.max(t, 0), Math.max(0.05, dur - 0.05)); }catch(e){}
          setTimeout(res, 3000);
        });
        const w = v.videoWidth, h = v.videoHeight;
        if(!w || !h) continue;
        const sc = Math.min(1, 1280 / Math.max(w, h));
        cv.width = Math.round(w * sc); cv.height = Math.round(h * sc);
        try{ cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height); }catch(e){ continue; }
        const d = cv.toDataURL('image/jpeg', 0.8);
        frames.push({ mt: 'image/jpeg', b64: d.split(',')[1] || '' });
        if(frames.length >= 4) break;
      }
    }catch(e){ /* unseekable/unsupported video — text note still goes out */ }
    finally{ URL.revokeObjectURL(url); }
    return frames;
  }
  async function addFiles(list){'''
edits.append(('  async function addFiles(list){', helpers))

# 5) addFiles branches: capture pixels
edits.append((
'''      const a = { n: f.name, sz: f.size, ty: f.type || '' };
      if((f.type || '').indexOf('image/') === 0){
        a.d = await readDataURL(f);
      }else if(isVid){
        a.vid = true;                                    // chip only — the brain reads the text note
      }else if((f.type || '').indexOf('text/') === 0 || (f.type || '').indexOf('json') > -1 || TXT_RE.test(f.name)){
        a.txt = await readText(f);
      }''',
'''      const a = { n: f.name, sz: f.size, ty: f.type || '' };
      if((f.type || '').indexOf('image/') === 0){
        const im = await shrinkImage(f);                 // downscaled copy: chip preview + real vision
        a.d = im.d;
        a.send = [{ mt: im.mt, b64: im.b64 }];           // actual pixels ride along — the brain sees them
      }else if(isVid){
        a.vid = true;
        a.send = await videoFrames(f);                   // keyframes — the brain watches the clip
      }else if((f.type || '').indexOf('text/') === 0 || (f.type || '').indexOf('json') > -1 || TXT_RE.test(f.name)){
        a.txt = await readText(f);
      }'''
))

# 6) notes mention blocks / keyframes
edits.append((
'''    else if((a.ty || '').indexOf('image/') === 0) last += '\\n\\n[attached image: ' + a.n + ' — ' + window.fmtSz(a.sz) + ']';
    else if(a.vid) last += '\\n\\n[attached video: ' + a.n + ' — ' + window.fmtSz(a.sz) + ']';''',
'''    else if((a.ty || '').indexOf('image/') === 0) last += '\\n\\n[attached image: ' + a.n + ' — ' + window.fmtSz(a.sz) + ' — attached as real image blocks]';
    else if(a.vid) last += '\\n\\n[attached video: ' + a.n + ' — ' + window.fmtSz(a.sz) + ' — ' + ((a.send && a.send.length) || 0) + ' keyframes attached as image blocks]';'''
))

# 7) askBrain: multipart content when pixels exist
edits.append((
'''  const ctx = brainContext(c);
  if(ctx.length) ctx[ctx.length - 1].content = last;   // attachments ride along as text notes''',
'''  const sends = [];
  (atts || []).forEach(a => (a.send || []).forEach(s => sends.push(s)));
  const ctx = brainContext(c);
  if(ctx.length){
    if(sends.length){                                  // real pixels — Anthropic-style image blocks
      const blocks = [{ type: 'text', text: last }];
      sends.slice(0, 8).forEach(s => blocks.push({ type: 'image', source: { type: 'base64', media_type: s.mt || 'image/jpeg', data: s.b64 } }));
      ctx[ctx.length - 1].content = blocks;
    }else ctx[ctx.length - 1].content = last;          // attachments ride along as text notes
  }'''
))

# 8) brainContext keeps vision descriptions for follow-ups
edits.append((
"  return c.messages.slice(-20).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: m.t }));",
"  return c.messages.slice(-20).map(m => ({ role: m.r === 'u' ? 'user' : 'assistant', content: (m.t || '') + (m.vision ? '\\n\\n' + m.vision : '') }));"
))

# 9) store the server's vision description on the user message
edits.append((
'''  if(!failed){
    chip.textContent = 'online';                       // one brain — no model names shown
    NET.live = true; renderStatus();''',
'''  if(!failed){
    if(d.vision){                                      // remember what the AI saw, for follow-up turns
      const um = c.messages.filter(x => x.r === 'u').pop();
      if(um && !um.vision) um.vision = d.vision;
      save();
    }
    chip.textContent = 'online';                       // one brain — no model names shown
    NET.live = true; renderStatus();'''
))

ok = True
for old, new in edits:
    if src.count(old) < 1:
        print('MISS:', old[:90].replace('\n', '⏎')); ok = False
        continue
    src = src.replace(old, new)

if not ok:
    sys.exit('PATCH FAILED — nothing written')

open(SRC, 'w', encoding='utf-8').write(src)

# verification
v = open(SRC, encoding='utf-8').read()
checks = {
    'i-chev symbol': v.count('<symbol id="i-chev"') == 1,
    'pills use chevron': v.count('mp-n">Flash</span><i class="ic small" data-ic="i-chev"') == 2,
    'no pill uses i-down': v.count('mp-n">Flash</span><i class="ic small" data-ic="i-down"') == 0,
    'export keeps i-down': 'Export chats (JSON)</button>' in v and 'data-ic="i-down"></i> Export' in v,
    'chev css': '.mwrap:has(.mmenu.open)' in v,
    'shrinkImage': 'async function shrinkImage' in v,
    'videoFrames': 'async function videoFrames' in v,
    'send blocks client': "type: 'image', source: { type: 'base64'" in v,
    'vision memory': 'm.vision' in v,
    'store vision': 'd.vision' in v,
    'keyframe note': 'keyframes attached as image blocks' in v,
}
for k, good in checks.items():
    print(('PASS ' if good else 'FAIL ') + k)
if not all(checks.values()):
    sys.exit('VERIFY FAILED')
print('OK — client patched')
