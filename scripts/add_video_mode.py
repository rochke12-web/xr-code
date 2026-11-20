#!/usr/bin/env python3
"""Revive Video Mode in the XR-Code built app.

Adds a 4th chat mode alongside koder/qna/image:
  - 'video' entry in MODES (name + icon)
  - Video Mode buttons in both mode menus (home + chat)
  - sendMsg branch that calls /api/video, polls the job, renders the mp4
  - mode validator accepts 'video'
  - quota bubble when the 3/day cap is hit

Every replacement is asserted — a missed pattern fails the script loudly.
"""
import re, sys

HTML = "/home/z/my-project/download/xr-code.html"

def apply(path, subs, regex_subs=()):
    s = open(path, encoding="utf-8").read()
    for old, new in subs:
        n = s.count(old)
        assert n >= 1, f"MISS in {path}: {old[:90]!r} (count {n})"
        s = s.replace(old, new)
        print(f"ok  x{n}: {old[:70]!r}")
    for pat, new in regex_subs:
        s2, n = re.subn(pat, new, s, flags=re.S)
        assert n >= 1, f"MISS regex in {path}: {pat[:80]!r}"
        s = s2
        print(f"ok regex x{n}: {pat[:70]!r}")
    open(path, "w", encoding="utf-8").write(s)
    print(f"--- wrote {path} ---")

# 1. remove the video-mode suppression lines (1215-1216)
SUPPRESS = """  if(S.mode === 'sight' || S.mode === 'imagine') S.mode = 'image';   // visual modes merged into Image Mode
  if(S.mode === 'video') S.mode = 'koder';                           // films ride the brain now
  if(S.mode !== 'koder' && S.mode !== 'qna' && S.mode !== 'image') S.mode = 'koder';   // three modes: koder | qna | image"""
SUPPRESS_NEW = """  if(S.mode === 'sight' || S.mode === 'imagine') S.mode = 'image';   // visual modes merged into Image Mode
  if(S.mode !== 'koder' && S.mode !== 'qna' && S.mode !== 'image' && S.mode !== 'video') S.mode = 'koder';   // four modes: koder | qna | image | video"""

# 2. add 'video' to MODES
MODES_OLD = "const MODES = { image: { n: 'Image', ic: 'i-img' }, koder: { n: 'Koder', ic: 'i-cpu' }, qna: { n: 'QnA', ic: 'i-qna' } };"
MODES_NEW = "const MODES = { image: { n: 'Image', ic: 'i-img' }, video: { n: 'Video', ic: 'i-video' }, koder: { n: 'Koder', ic: 'i-cpu' }, qna: { n: 'QnA', ic: 'i-qna' } };"

# 3. placeholder copy when in video mode
PLACE_OLD = "const ci = $('#chatInput'); if(ci) ci.placeholder = S.mode === 'image' ? 'Describe the image to paint… (a follow-up like “make it night” refines the last one)' : 'Message XR Code...';"
PLACE_NEW = "const ci = $('#chatInput'); if(ci) ci.placeholder = S.mode === 'image' ? 'Describe the image to paint… (a follow-up like “make it night” refines the last one)' : S.mode === 'video' ? 'Describe the video to make… (a 10-second clip — add “with narration” for a voice-over)' : 'Message XR Code...';"

# 4. add Video Mode buttons to BOTH mode menus (home + chat). Each menu has the
#    same three buttons in the same order; we insert a video button after image.
MENU_BTN_OLD = """<button type="button" data-mode="image"><b>Image Mode</b><small>text → art — describe it, styles, refine it — painted in seconds</small></button>
              <button type="button" data-mode="qna"><b>QnA Mode</b><small>sources never shown</small></button>"""
MENU_BTN_NEW = """<button type="button" data-mode="image"><b>Image Mode</b><small>text → art — describe it, styles, refine it — painted in seconds</small></button>
              <button type="button" data-mode="video"><b>Video Mode</b><small>text → film — a 10-second clip, optional narration · 3/day free</small></button>
              <button type="button" data-mode="qna"><b>QnA Mode</b><small>sources never shown</small></button>"""
MENU_BTN_OLD_CHAT = """<button type="button" data-mode="image"><b>Image Mode</b><small>text → art — describe it, styles, refine it — painted in seconds</small></button>
            <button type="button" data-mode="qna"><b>QnA Mode</b><small>sources never shown</small></button>"""
MENU_BTN_NEW_CHAT = """<button type="button" data-mode="image"><b>Image Mode</b><small>text → art — describe it, styles, refine it — painted in seconds</small></button>
            <button type="button" data-mode="video"><b>Video Mode</b><small>text → film — a 10-second clip, optional narration · 3/day free</small></button>
            <button type="button" data-mode="qna"><b>QnA Mode</b><small>sources never shown</small></button>"""

# 5. add an i-video svg symbol (next to i-img) so the sidebar/menu icon renders
ICON_OLD = '<symbol id="i-img" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></symbol>'
ICON_NEW = ICON_OLD + '<symbol id="i-video" viewBox="0 0 24 24"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></symbol>'

# 6. the image-mode branch in askBrain — we add a video branch right before it.
#    The branch mirrors image: call /api/video, then poll /api/video?id= for status.
IMG_BRANCH_START = "  if(S.mode === 'image' && (text || '').trim()){         // Image mode — the brain writes the prompt, the painter paints it"

VIDEO_BRANCH = """  if(S.mode === 'video' && (text || '').trim()){         // Video mode — text-to-video (10s, no watermark), optional narration
    const wantNarrate = /\\bnarrat/i.test(text) || /\\bvoice[- ]?over\\b|\\bvoiceover\\b/i.test(text);
    chip.textContent = 'filming…';
    body0.innerHTML = '<span class="paint-label">queued — filming takes ~2-5 min…</span>';
    let q = null;
    try{
      const res = await fetch(API_BASE + '/api/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, mode: 'clip', duration: 10, withAudio: !!wantNarrate, narrate: !!wantNarrate, quality: 'speed', size: '1920x1080' })
      });
      q = await res.json().catch(() => null);
      if(res.status === 401 && q && q.error === 'auth'){ chip.textContent = 'Hosted by Z.ai'; pen.remove(); window.xrSessionExpired(); return; }
      if(q && q.limit){                       // 3/day cap hit — calm bubble, no model names
        chip.textContent = 'Hosted by Z.ai'; pen.remove();
        typeReply(c, splitFence(q.text || "You've used today's video allowance — it resets at 00:00 UTC."), null);
        return;
      }
      if(!(q && q.ok)) q = null;
    }catch(e){ q = null; }
    if(!q){
      chip.textContent = 'offline'; pen.remove();
      typeReply(c, splitFence('The film studio is warming up right now — give it a moment and try again.'), null);
      return;
    }
    // poll the detached driver until done / error
    const jobId = q.id;
    let job = null, pollErr = null;
    for(let i = 0; i < 240; i++){            // up to ~20 min of polling (5s cadence)
      await new Promise(r => setTimeout(r, 5000));
      try{
        const r = await fetch(API_BASE + '/api/video?id=' + jobId, { cache: 'no-store' });
        const d = await r.json().catch(() => null);
        if(d && d.ok && d.job){
          job = d.job;
          if(job.status === 'done' || job.status === 'error') break;
          if(job.step) body0.querySelector('.paint-label').textContent = job.step + (job.note ? ' — ' + job.note : '');
        }
      }catch(e){ pollErr = e; }
    }
    chip.textContent = 'Hosted by Z.ai';
    if(job && job.status === 'done' && job.result && job.result.url){
      const cap = '✦ Here is your 10-second clip' + (wantNarrate ? ' with narration.' : '.');
      typeReply(c, Object.assign(splitFence(cap), { asset: { type: 'video', url: job.result.url, cover: job.cover || undefined } }), pen);
    }else{
      pen.remove();
      const why = (job && job.error) ? '' : '';
      typeReply(c, splitFence('The film studio could not finish that clip — please try again in a moment.' + why), null);
    }
    return;
  }
  """ + IMG_BRANCH_START

apply(HTML, [
    (SUPPRESS, SUPPRESS_NEW),
    (MODES_OLD, MODES_NEW),
    (PLACE_OLD, PLACE_NEW),
    (MENU_BTN_OLD, MENU_BTN_NEW),
    (MENU_BTN_OLD_CHAT, MENU_BTN_NEW_CHAT),
    (ICON_OLD, ICON_NEW),
    (IMG_BRANCH_START, VIDEO_BRANCH),
])

# final proof
s = open(HTML, encoding="utf-8").read()
for bad in []:
    pass
assert "data-mode=\"video\"" in s, "video mode button missing"
assert "'video'" in s, "video mode ref missing"
assert "i-video" in s, "video icon missing"
assert "/api/video" in s, "video API call missing"
print("PROOF: Video Mode wired (mode button, MODES entry, icon, sendMsg branch, /api/video call)")
