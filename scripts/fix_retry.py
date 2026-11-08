"""fix_retry.py — never show a dead-end 'AI unreachable' again:
1. askBrain: one quiet auto-retry (4s) before giving up
2. on final failure: error bubble + visible 'Try again' button (not typed into history)
3. CSS for the retry pill
"""
import re, subprocess, shutil

P = '/home/z/my-project/download/xr-code.html'
SNAP = '/home/z/my-project/scripts/xr-pre-retry.html'
shutil.copy(P, SNAP)

src = open(P, encoding='utf-8').read()
fails = []

def rep(old, new, n=1, tag=''):
    global src
    c = src.count(old)
    if c != n:
        fails.append(f'[{tag}] expected {n}, found {c}')
        return
    src = src.replace(old, new)

OLD_FN = """async function askBrain(c, text, atts){
  const chip = $('#chatModelChip');
  chip.textContent = 'engine: ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode') + ' \u00b7 thinking\u2026';
  const box0 = $('#msgs');                               // animated thinking bubble (like modern AI chats)
  const pen = document.createElement('div'); pen.className = 'msg a';
  const who0 = document.createElement('span'); who0.className = 'who'; who0.textContent = 'XR CODE';
  const body0 = document.createElement('div'); body0.className = 'bubble';
  const dots = document.createElement('span'); dots.className = 'dots';
  dots.innerHTML = '<i></i><i></i><i></i>';
  body0.append(dots);
  pen.append(who0, body0);
  if(currentChat().id === c.id) box0.append(pen);
  box0.scrollTop = box0.scrollHeight;
  try{
    let last = text;                               // feed file contents to the hosted brain
    (atts || []).forEach(a => {
      if(a.txt) last += '\\n\\n[attached file: ' + a.n + ']\\n' + String(a.txt).slice(0, 6000);
      else if((a.ty || '').indexOf('image/') === 0) last += '\\n\\n[attached image: ' + a.n + ' \u2014 ' + window.fmtSz(a.sz) + ']';
      else last += '\\n\\n[attached file: ' + a.n + ' \u2014 ' + window.fmtSz(a.sz) + ']';
    });
    const ctx = brainContext(c);
    if(ctx.length) ctx[ctx.length - 1].content = last;
    const res = await fetch(API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: ctx, mode: S.mode || 'coder' })
    });
    const d = await res.json().catch(() => null);
    if(!d || !d.ok) throw new Error(d && d.error ? d.error : 'HTTP ' + res.status);
    const t = (d.text || '').trim();
    if(!t) throw new Error('empty reply');
    chip.textContent = 'engine: live \u00b7 ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    NET.live = true; renderStatus();
    typeReply(c, splitFence(t), true, pen);
  }catch(err){
    chip.textContent = 'engine: XR CODE AI \u00b7 ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    if(!API_BASE){
      typeReply(c, genReply(text), false, pen);          // local file preview \u2014 built-in fallback replies
      toast('Local preview \u2014 the hosted brain answers on the live site');
    } else {
      typeReply(c, { text: 'The AI server is unreachable right now \u2014 check your connection and try again in a moment.' }, false, pen);
    }
  }
}"""

NEW_FN = """async function askBrain(c, text, atts){
  const chip = $('#chatModelChip');
  chip.textContent = 'engine: ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode') + ' \u00b7 thinking\u2026';
  const box0 = $('#msgs');                               // animated thinking bubble (like modern AI chats)
  const pen = document.createElement('div'); pen.className = 'msg a';
  const who0 = document.createElement('span'); who0.className = 'who'; who0.textContent = 'XR CODE';
  const body0 = document.createElement('div'); body0.className = 'bubble';
  const dots = document.createElement('span'); dots.className = 'dots';
  dots.innerHTML = '<i></i><i></i><i></i>';
  body0.append(dots);
  pen.append(who0, body0);
  if(currentChat().id === c.id) box0.append(pen);
  box0.scrollTop = box0.scrollHeight;
  let last = text;                               // feed file contents to the hosted brain
  (atts || []).forEach(a => {
    if(a.txt) last += '\\n\\n[attached file: ' + a.n + ']\\n' + String(a.txt).slice(0, 6000);
    else if((a.ty || '').indexOf('image/') === 0) last += '\\n\\n[attached image: ' + a.n + ' \u2014 ' + window.fmtSz(a.sz) + ']';
    else last += '\\n\\n[attached file: ' + a.n + ' \u2014 ' + window.fmtSz(a.sz) + ']';
  });
  const ctx = brainContext(c);
  if(ctx.length) ctx[ctx.length - 1].content = last;
  const call = () => fetch(API_BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: ctx, mode: S.mode || 'coder' })
  });
  let d = null, failed = null;
  for(let attempt = 0; attempt < 2; attempt++){        // one quiet auto-retry before giving up
    try{
      const res = await call();
      d = await res.json().catch(() => null);
      if(d && d.ok && (d.text || '').trim()){ failed = null; break; }
      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);
    }catch(e){ failed = e; }
    if(attempt === 0){
      chip.textContent = 'engine: busy \u00b7 retrying\u2026';
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  if(!failed){
    chip.textContent = 'engine: live \u00b7 ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    NET.live = true; renderStatus();
    typeReply(c, splitFence((d.text || '').trim()), true, pen);
    return;
  }
  chip.textContent = 'engine: XR CODE AI \u00b7 ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
  if(!API_BASE){
    typeReply(c, genReply(text), false, pen);          // local file preview \u2014 built-in fallback replies
    toast('Local preview \u2014 the hosted brain answers on the live site');
    return;
  }
  pen.remove();                                        // never a dead end \u2014 offer a visible retry
  const el = document.createElement('div'); el.className = 'msg a';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = 'XR CODE';
  const body = document.createElement('div'); body.className = 'bubble';
  body.textContent = 'The AI server is unreachable right now \u2014 check your connection and try again in a moment.';
  const ch = document.createElement('span'); ch.className = 'chip'; ch.textContent = 'engine: offline';
  const re = document.createElement('button'); re.className = 'retry-btn'; re.type = 'button';
  re.innerHTML = '<svg class="ic small"><use href="#i-sync"/></svg>Try again';
  re.onclick = () => {
    const lm = c.messages[c.messages.length - 1];
    if(!lm || lm.r !== 'u' || lm.t !== text){ toast('Context moved on \u2014 send your message again'); el.remove(); return; }
    el.remove(); askBrain(c, text, atts);
  };
  const line = document.createElement('div'); line.className = 'retry-line'; line.append(re);
  el.append(who, body, ch, line);
  if(currentChat().id === c.id) box0.append(el);
  box0.scrollTop = box0.scrollHeight;
}"""

rep(OLD_FN, NEW_FN, 1, 'askBrain')

rep(".msg .chip{align-self:flex-start}",
""".msg .chip{align-self:flex-start}
.retry-line{display:flex;justify-content:flex-start}
.retry-btn{
  display:inline-flex;align-items:center;gap:6px;margin-top:2px;
  font-family:var(--font-mono);font-size:11px;letter-spacing:.04em;color:var(--text);
  border:1px solid var(--line);border-radius:999px;padding:6px 14px;background:var(--panel-2);
  transition:border-color .18s,color .18s,box-shadow .18s;
}
.retry-btn:hover{border-color:var(--accent-2);color:var(--accent);box-shadow:var(--shadow)}
.retry-btn .ic{width:13px;height:13px}""", 1, 'CSS')

if fails:
    print('FAIL: no changes written')
    [print(' ', f) for f in fails]
    raise SystemExit(1)

open(P, 'w', encoding='utf-8').write(src)

plain = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
checks = {
    'retry-btn': 4, 'Try again': 1, 'engine: busy': 1,
    "typeReply(c, { text: 'The AI server": 0, 'askBrain(c, text, atts)': 2,
}
bad = {k: (plain.count(k), v) for k, v in checks.items() if plain.count(k) != v}
if bad:
    print('SANITY FAIL:', bad); raise SystemExit(1)

m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/retry_check.js', 'w').write(m.group(1))
r = subprocess.run(['node', '--check', '/tmp/retry_check.js'], capture_output=True, text=True)
print('node --check:', r.returncode, r.stderr[:400])
print('OK  snapshot:', SNAP)
