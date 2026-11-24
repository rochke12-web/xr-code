#!/usr/bin/env python3
"""Port the mobile-freeze fixes into the canonical UI source download/xr-code.html.

Fixes:
1. viewport interactive-widget=resizes-content (mobile keyboard no longer covers/breaks layout)
2. save() re-renders isolated — one render exception can no longer kill a send flow
   and strand the thinking bubble (the "UI glitched, can't do anything" symptom)
3. typeReply autoscroll only when near bottom (no 16ms scroll fight on mobile) +
   exception-safe interval that cleans up cursor/bubble on any error
4. mobile-capped generated media CSS + async image decode
5. pen.dataset.ts timestamp + 5s stuck-bubble watchdog
"""
import sys

P = '/home/z/my-project/download/xr-code.html'
s = open(P).read()
n0 = len(s)

def rep(old, new, cnt=1):
    global s
    found = s.count(old)
    assert found == cnt, f'anchor count {found} != {cnt}: {old[:70]!r}'
    s = s.replace(old, new)

# 1 viewport
rep('initial-scale=1.0, viewport-fit=cover">',
    'initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content">')

# 2 save() isolation
rep('function save(){ try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} updateSyncUI(); renderStatus(); renderChatList(); renderModel(); if(window.__xrCloudSchedule) window.__xrCloudSchedule(); }',
    'function save(){ try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} try{ updateSyncUI(); renderStatus(); renderChatList(); renderModel(); if(window.__xrCloudSchedule) window.__xrCloudSchedule(); }catch(e){} }')

# 3 typeReply rework (canonical word-by-word streaming variant)
rep("""  const cur = document.createElement('span'); cur.className = 'stream-cursor';
  body.append(cur);
  let i = 0, word = null;
  const iv = setInterval(() => {
    if(!document.contains(el)){           // user switched chats while typing
      clearInterval(iv);
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, parts: reply.parts, asset: reply.asset, m: 'live' });
      save(); return;
    }
    if(i < reply.text.length){
      // stream word by word — each word fades/deblurs in as its first char lands
      const step = reply.text.length > 900 ? 2 : 1;   // keep the human-like pace
      for(let k = 0; k < step && i < reply.text.length; k++){
        const ch = reply.text[i++];
        if(word && /\\s/.test(ch)){ word.textContent += ch; word = null; }  // seal the word
        else if(!word){
          word = document.createElement('span'); word.className = 'wfade';
          word.textContent = ch;
          body.insertBefore(word, cur);
        } else {
          word.textContent += ch;
        }
      }
      box.scrollTop = box.scrollHeight;
    }""",
"""  const cur = document.createElement('span'); cur.className = 'stream-cursor';
  body.append(cur);
  let i = 0, word = null;
  const stick = () => {                              // only autoscroll when the user is at the bottom —
    const gap = box.scrollHeight - box.scrollTop - box.clientHeight;   // never fight their finger on mobile
    if(gap < 140) box.scrollTop = box.scrollHeight;
  };
  stick();
  const iv = setInterval(() => {
    try{
    if(!document.contains(el)){           // user switched chats while typing
      clearInterval(iv);
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, parts: reply.parts, asset: reply.asset, m: 'live' });
      save(); return;
    }
    if(i < reply.text.length){
      // stream word by word — each word fades/deblurs in as its first char lands
      const step = reply.text.length > 900 ? 2 : 1;   // keep the human-like pace
      for(let k = 0; k < step && i < reply.text.length; k++){
        const ch = reply.text[i++];
        if(word && /\\s/.test(ch)){ word.textContent += ch; word = null; }  // seal the word
        else if(!word){
          word = document.createElement('span'); word.className = 'wfade';
          word.textContent = ch;
          body.insertBefore(word, cur);
        } else {
          word.textContent += ch;
        }
      }
      stick();
    }""")

# 3b close the try/catch around the interval body (completion block tail)
rep("""      save();
    }
  }, 16);
}""",
"""      save();
    }
    }catch(e){ clearInterval(iv); try{ if(cur.parentNode) cur.remove(); if(pen && pen.parentNode) pen.remove(); }catch(_){} }
  }, 16);
}""", cnt=1)

# 4 mobile media CSS
rep('.gen-media img{display:block;width:100%;transition:transform .5s var(--ease)}',
""".gen-media img{display:block;width:100%;transition:transform .5s var(--ease);decoding:async}
@media (max-width:640px){                          /* mobile: cap generated images so a photo render
                                                      can never blow up the layout or the compositor */
  .gen-media{max-width:min(340px,88vw)}
  .gen-media img{max-height:340px;width:auto;max-width:100%;object-fit:contain;margin:0 auto}
  .gen-media video{max-height:340px}
}""")

# 5 pen timestamp
rep('  pen.append(who0, body0);\n', '  pen.append(who0, body0);\n  pen.dataset.ts = Date.now();\n')

# 5b watchdog before the final </script></body></html> (always exactly once at EOF)
TAIL = '\n</script>\n</body>\n</html>'
assert s.rstrip().endswith('</html>')
assert s.count(TAIL) == 1, s.count(TAIL)
s = s.replace(TAIL, """
/* mobile freeze watchdog: a crashed handler must never leave a stuck
   thinking-bubble or a wedged model chip — sweep every 5s and self-heal */
setInterval(function(){
  try{
    document.querySelectorAll('.msg.a').forEach(function(m){
      if(m.querySelector('.dots') && Date.now() - Number(m.dataset.ts || 0) > 120000) m.remove();
    });
    var chip = document.querySelector('#chatModelChip');
    if(chip && chip.textContent === 'thinking\\u2026' && !document.querySelector('.msg.a .dots')) chip.textContent = 'Hosted by Z.ai';
  }catch(e){}
}, 5000);""" + TAIL)

open(P, 'w').write(s)
print(f'patched OK: {n0} -> {len(s)} bytes')
