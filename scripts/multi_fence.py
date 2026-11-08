"""multi_fence.py — AI replies may contain SEVERAL fenced code blocks.
Old splitFence kept only the first -> raw ``` leaked into the bubble.
Now: ordered parts [{t}|{code}...] rendered as bubble / code-block sequence,
typed first text part keeps the streaming feel; storage keeps legacy fields.
"""
import re, subprocess, shutil

P = '/home/z/my-project/download/xr-code.html'
SNAP = '/home/z/my-project/scripts/xr-pre-multifence.html'
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

rep("""function splitFence(t){                           // '```py\\ncode```' -> { text, code }
  const m = t.match(/```[\\w+-]*\\r?\\n([\\s\\S]*?)```/);
  if(!m) return { text: t };
  return { text: (t.slice(0, m.index) + t.slice(m.index + m[0].length)).trim(), code: m[1].replace(/\\s+$/, '') };
}""",
"""function splitFence(t){                           // ALL '```py\\ncode```' -> ordered parts
  const parts = [];
  const re = /```[\\w+-]*\\r?\\n([\\s\\S]*?)```/g;
  let last = 0, m;
  while((m = re.exec(t))){
    const before = t.slice(last, m.index).trim();
    if(before) parts.push({ t: before });
    parts.push({ code: m[1].replace(/\\s+$/, '') });
    last = m.index + m[0].length;
  }
  const tail = t.slice(last).trim();
  if(tail || !parts.length) parts.push({ t: tail || t });
  const firstText = parts.find(p => p.t !== undefined) || {};
  const firstCode = parts.find(p => p.code !== undefined);
  return { parts, text: firstText.t !== undefined ? firstText.t : '', code: firstCode ? firstCode.code : undefined };
}""", 1, 'splitFence')

rep("""    if(i >= reply.text.length){
      clearInterval(iv);
      cur.remove();
      body.textContent = reply.text;
      if(reply.code){
        el.append(codeBlock(reply.code));
      }
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });
      c.ts = now();
      save();
    }""",
"""    if(i >= reply.text.length){
      clearInterval(iv);
      cur.remove();
      body.textContent = reply.text;
      (reply.parts || []).forEach((p, ix) => {
        if(ix === 0 && p.t !== undefined) return;      // first text part is the typed bubble
        if(p.code !== undefined){ el.append(codeBlock(p.code)); }
        else { const nb = document.createElement('div'); nb.className = 'bubble'; nb.textContent = p.t; el.append(nb); }
      });
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, parts: reply.parts, m: live ? 'live' : 'demo' });
      c.ts = now();
      save();
    }""", 1, 'typeReply-done')

rep("      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });\n      save(); return;",
    "      c.messages.push({ r: 'a', t: reply.text, code: reply.code, parts: reply.parts, m: live ? 'live' : 'demo' });\n      save(); return;", 1, 'typeReply-switch')

rep("""  if(m.code){ w.append(codeBlock(m.code)); }""",
"""  if(m.parts && m.parts.length){
    m.parts.forEach(p => {
      if(p.code !== undefined) w.append(codeBlock(p.code));
      else { const nb = document.createElement('div'); nb.className = 'bubble'; nb.textContent = p.t; w.append(nb); }
    });
  } else if(m.code){ w.append(codeBlock(m.code)); }""", 1, 'msgEl')

if fails:
    print('FAIL: no changes written')
    [print(' ', f) for f in fails]
    raise SystemExit(1)

open(P, 'w', encoding='utf-8').write(src)

plain = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
checks = {
    "parts: reply.parts": 2, "reply.parts || []": 1,
    "if(m.parts && m.parts.length)": 1,
    "while((m = re.exec(t)))": 1,
}
bad = {k: (plain.count(k), v) for k, v in checks.items() if plain.count(k) != v}
if bad:
    print('SANITY FAIL:', bad); raise SystemExit(1)

m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/mf_check.js', 'w').write(m.group(1))
r = subprocess.run(['node', '--check', '/tmp/mf_check.js'], capture_output=True, text=True)
print('node --check:', r.returncode, r.stderr[:400])
print('OK  snapshot:', SNAP)
