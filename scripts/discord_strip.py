#!/usr/bin/env python3
# Strip ALL Discord auth UI/logic + add model selector to home composer.
# Base: download/xr-code.html (rolled back to xr-pre-discord.html state).
import re, sys

P = 'download/xr-code.html'
s = open(P, encoding='utf-8').read()
orig = s

def rep(old, new, n=1, tag=''):
    global s
    c = s.count(old)
    if c != n:
        print(f'FAIL {tag}: anchor count {c} != {n}')
        sys.exit(1)
    s = s.replace(old, new)
    print(f'ok   {tag}')

# ---------- 1. home composer: add model selector between input and send ----------
rep(
'''          <input id="homeInput" autocomplete="off" placeholder="What would you like to do with XR-Code?">
          <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>''',
'''          <input id="homeInput" autocomplete="off" placeholder="What would you like to do with XR-Code?">
          <div class="model-wrap" id="homeModelWrap">
            <button class="model-btn" id="homeModelBtn" type="button" title="AI model"><span class="ml">prime-v1-flash</span><span class="caret">&#9662;</span></button>
            <div class="model-menu" id="homeModelMenu"></div>
          </div>
          <button class="send-btn" type="submit" title="Send"><i class="ic" data-ic="i-chev"></i></button>''',
tag='1-home-selector-html')

# ---------- 2. model selector JS: support both composers, shared state ----------
OLD_JS = '''/* ---------- model selector (prime ai) ---------- */
(function(){
  const MODELS = [
    { id: 'prime-v1-flash', tag: 'default' },
    { id: 'prime-v1-vision', tag: 'vision' },
    { id: 'glm-5.3', tag: 'flagship' },
    { id: 'glm-5.2' },
    { id: 'glm-5.3-flash', tag: 'fast' },
  ];
  const KEY = 'xr_model';
  const wrap = $('#modelWrap'), btn = $('#modelBtn'), menu = $('#modelMenu');
  const label = btn.querySelector('.ml');
  function cur(){
    let m = '';
    try{ m = localStorage.getItem(KEY) || ''; }catch(e){}
    return MODELS.some(x => x.id === m) ? m : MODELS[0].id;
  }
  function drawBtn(){ label.textContent = cur(); }
  function drawMenu(){
    menu.innerHTML = '';
    const h = document.createElement('div'); h.className = 'mh'; h.textContent = 'Prime AI models';
    menu.append(h);
    const c = cur();
    MODELS.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'model-item' + (m.id === c ? ' on' : '');
      const i = document.createElement('span'); i.className = 'mi'; i.textContent = m.id;
      b.append(i);
      const t = document.createElement('span'); t.className = 'mt'; t.textContent = m.id === c ? 'selected' : (m.tag || '');
      b.append(t);
      b.onclick = () => {
        try{ localStorage.setItem(KEY, m.id); }catch(e){}
        drawBtn(); drawMenu(); wrap.classList.remove('open');
        toast('Model: ' + m.id);
      };
      menu.append(b);
    });
  }
  btn.onclick = e => {
    e.stopPropagation();
    drawMenu();
    wrap.classList.toggle('open');
  };
  document.addEventListener('click', e => {
    if(!wrap.contains(e.target)) wrap.classList.remove('open');
  });
  drawBtn();
  window.__xrModel = cur;                        // the brain reads this on every send
})();'''

NEW_JS = '''/* ---------- model selector (prime ai) ---------- */
(function(){
  const MODELS = [
    { id: 'prime-v1-flash', tag: 'default' },
    { id: 'prime-v1-vision', tag: 'vision' },
    { id: 'glm-5.3', tag: 'flagship' },
    { id: 'glm-5.2' },
    { id: 'glm-5.3-flash', tag: 'fast' },
  ];
  const KEY = 'xr_model';
  function cur(){
    let m = '';
    try{ m = localStorage.getItem(KEY) || ''; }catch(e){}
    return MODELS.some(x => x.id === m) ? m : MODELS[0].id;
  }
  const WIRED = [];
  function wire(sel){
    const wrap = $(sel[0]), btn = $(sel[1]), menu = $(sel[2]);
    if(!wrap || !btn || !menu) return;
    const label = btn.querySelector('.ml');
    function drawBtn(){ label.textContent = cur(); }
    function drawMenu(){
      menu.innerHTML = '';
      const h = document.createElement('div'); h.className = 'mh'; h.textContent = 'Prime AI models';
      menu.append(h);
      const c = cur();
      MODELS.forEach(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'model-item' + (m.id === c ? ' on' : '');
        const i = document.createElement('span'); i.className = 'mi'; i.textContent = m.id;
        b.append(i);
        const t = document.createElement('span'); t.className = 'mt'; t.textContent = m.id === c ? 'selected' : (m.tag || '');
        b.append(t);
        b.onclick = () => {
          try{ localStorage.setItem(KEY, m.id); }catch(e){}
          WIRED.forEach(w => { w.drawBtn(); w.drawMenu(); w.wrap.classList.remove('open'); });
          toast('Model: ' + m.id);
        };
        menu.append(b);
      });
    }
    btn.onclick = e => {
      e.stopPropagation();
      drawMenu();
      WIRED.forEach(w => { if(w.wrap !== wrap) w.wrap.classList.remove('open'); });
      wrap.classList.toggle('open');
    };
    document.addEventListener('click', e => {
      if(!wrap.contains(e.target)) wrap.classList.remove('open');
    });
    drawBtn();
    WIRED.push({ wrap, drawBtn, drawMenu });
  }
  wire(['#modelWrap', '#modelBtn', '#modelMenu']);
  wire(['#homeModelWrap', '#homeModelBtn', '#homeModelMenu']);
  window.__xrModel = cur;                        // the brain reads this on every send
})();'''

rep(OLD_JS, NEW_JS, tag='2-model-js-multiwire')

# ---------- 3. remove mock login/logout/providerLabel ----------
rep(
'''/* ---------- auth & engine status ---------- */
function login(provider){                            // optional account link (chat sync only)
  S.user = { provider: 'discord', name: 'Yug and Saksham (Discord)' };
  S.lastSync = now();
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Linked Discord — chats are marked as synced');
}
function logout(){
  S.user = null; S.lastSync = null;
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Unlinked — chats keep saving in this browser');
}
function providerLabel(p){
  return 'your Discord account';
}''',
'''/* ---------- engine status ---------- */''',
tag='3-remove-login-mock')

# ---------- 4. renderAccounts: local-only card, no link button ----------
rep(
'''function renderAccounts(){
  const box = $('#accBox'); box.innerHTML = '';
  if(S.user){
    const r = document.createElement('div'); r.className = 'acc-row';
    const i = document.createElement('div'); i.className = 'ai2';
    const n = document.createElement('div'); n.className = 'an'; n.textContent = S.user.name;
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Chats sync to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '') +
      ' · engine: ' + (NET.live ? 'XR Code AI (live)' : 'XR Code AI (offline)');
    i.append(n, s);
    const b = document.createElement('button'); b.className = 'mini-btn danger'; b.type = 'button'; b.textContent = 'Unlink';
    b.onclick = logout;
    r.append(i, b); box.append(r);
  } else {
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Not linked. Connecting Discord is optional — chats save in this browser either way.';
    const st = document.createElement('div'); st.className = 'login-stack'; st.style.marginTop = '8px';
    const d = document.createElement('button'); d.className = 'auth-btn'; d.type = 'button';
    d.innerHTML = '<svg class="ic"><use href="#i-discord"/></svg> Link Discord <span class="sub">optional</span>';
    d.onclick = () => login('discord');
    st.append(d);
    box.append(s, st);
  }
}''',
'''function renderAccounts(){
  const box = $('#accBox'); box.innerHTML = '';
  const r = document.createElement('div'); r.className = 'acc-row';
  const i = document.createElement('div'); i.className = 'ai2';
  const n = document.createElement('div'); n.className = 'an'; n.textContent = 'This browser';
  const s = document.createElement('div'); s.className = 'as';
  s.textContent = 'Chats save automatically on this device · engine: ' + (NET.live ? 'XR Code AI (live)' : 'XR Code AI (offline)');
  i.append(n, s);
  r.append(i); box.append(r);
}''',
tag='4-renderaccounts-local')

# ---------- 5. updateSyncUI: plain local-save line ----------
rep(
'''  if(S.user){
    span.innerHTML = 'Chats save to <b></b>' + (S.lastSync ? ' · synced ' + agoFull(S.lastSync) : ' · ready to sync');
    span.querySelector('b').textContent = providerLabel(S.user.provider);
  } else {
    span.textContent = 'Chats save locally — linking Discord (Settings) is optional.';
  }''',
'''  span.textContent = 'Chats save in this browser.';''',
tag='5-updatesyncui-local')

# ---------- 6. remove syncNow handler (JS) ----------
rep(
'''$('#syncNowBtn').onclick = () => {
  if(!S.user){ toast('Linking Discord (Settings) is optional — chats already save in this browser'); return; }
  S.lastSync = now(); save(); renderAccounts();
  toast('Chats synced to ' + providerLabel(S.user.provider));
};
''', '', tag='6-syncnow-js')

# ---------- 7. remove Sync now button (HTML) ----------
rep(
'''              <button class="mini-btn" id="syncNowBtn" type="button"><i class="ic small" data-ic="i-sync"></i> Sync now</button>
''', '', tag='7-syncnow-html')

# ---------- 8. settings note ----------
rep(
'Chats are stored in this browser. Linking Discord is optional &mdash; it only marks your chats as saved to that account. The AI brain is hosted on the XR-Code server — it just works for everyone.',
'Chats are stored in this browser. The AI brain is hosted on the XR-Code server — it just works for everyone.',
tag='8-settings-note')

# ---------- 9. neutral comment on user field ----------
rep(
"    user: null,              // optional Discord link — only marks chats as synced",
"    user: null,              // reserved",
tag='9-user-comment')

# ---------- 10. remove i-discord svg symbol ----------
m = re.search(r'<symbol id="i-discord".*?</symbol>', s)
if not m:
    print('FAIL 10: i-discord symbol not found'); sys.exit(1)
s = s[:m.start()] + s[m.end():]
print('ok   10-discord-symbol')

# ---------- save + verify ----------
open(P, 'w', encoding='utf-8').write(s)

left = re.findall(r'(?i)discord', s)
print('discord refs left:', len(left))
for kw in ['login(', 'logout(', 'providerLabel', 'syncNowBtn', 'S.lastSync', "S.user"]:
    hits = [i + 1 for i, line in enumerate(s.splitlines()) if kw in line]
    print(f'  {kw!r}: lines {hits}')
print('bytes:', len(orig), '->', len(s))
