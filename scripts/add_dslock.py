#!/usr/bin/env python3
# Add the Discord members-only lock screen to the XR-Code client (single-file app).
# Base: download/xr-code.html  — every anchor is count-checked before replacing.
import sys

P = '/home/z/my-project/download/xr-code.html'
s = open(P, encoding='utf-8').read()
orig_len = len(s)

def rep(old, new, n=1, tag=''):
    global s
    c = s.count(old)
    if c != n:
        print(f'FAIL {tag}: anchor count {c} != {n}')
        sys.exit(1)
    s = s.replace(old, new)
    print(f'ok   {tag}')

# ---------- 1. CSS: lock overlay + discord button ----------
rep('</style>', '''  /* ---------- discord gate lock ---------- */
  .ds-lock{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
  .ds-lock[hidden]{display:none}
  .ds-card{width:min(420px,92vw);background:var(--panel-2);border:1px solid var(--line);border-radius:22px;padding:34px 30px;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.5)}
  .ds-logo{height:56px;width:56px;margin:0 auto 14px;border-radius:14px;overflow:hidden}
  .ds-logo .logo-img{width:100%;height:100%;object-fit:cover;display:block}
  .ds-card h2{margin:0 0 8px;font-size:19px;letter-spacing:.02em;color:var(--text)}
  .ds-sub{margin:0 0 18px;font-size:12.5px;line-height:1.65;color:var(--muted)}
  .ds-err{margin:0 0 14px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,122,122,.35);background:rgba(255,122,122,.08);color:#ff9d9d;font-size:12px;line-height:1.5}
  .ds-btn{display:inline-flex;align-items:center;gap:9px;background:#5865F2;color:#fff;border:none;border-radius:12px;padding:12px 22px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit;transition:transform .15s,filter .15s}
  .ds-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
  .ds-btn:active{transform:translateY(0)}
  .ds-btn .ic{width:18px;height:18px}
  .ds-invite{display:inline-block;margin-top:12px;font-size:12px;color:var(--accent);text-decoration:none;border-bottom:1px dotted var(--muted)}
  .ds-fine{margin:16px 0 0;font-size:10.5px;color:var(--muted);letter-spacing:.04em}
  :root[data-theme="light"] .ds-lock{background:rgba(247,247,248,.72)}
</style>''', tag='1-lock-css')

# ---------- 2. HTML: lock overlay right after <body> ----------
rep('''<body>

<!-- ============ SVG ICON LIBRARY ============ -->''', '''<body>

<!-- ============ DISCORD GATE (members only) ============ -->
<div class="ds-lock" id="dsLock" hidden>
  <div class="ds-card">
    <div class="ds-logo"><img class="logo-img dark-only" data-asset="logo-dark" alt="XR-Code"><img class="logo-img light-only" data-asset="logo-light" alt="XR-Code"></div>
    <h2>Members only</h2>
    <p class="ds-sub">XR-Code AI is available to verified members of the XR server.<br>Join the server, take the <b>XR-Auth</b> role, then verify below.</p>
    <div class="ds-err" id="dsErr" hidden></div>
    <button class="ds-btn" id="dsBtn" type="button"><svg class="ic"><use href="#i-discord"/></svg>Verify with Discord</button>
    <br><a class="ds-invite" id="dsInvite" href="#" target="_blank" rel="noopener" hidden>Join the XR server</a>
    <p class="ds-fine">Verification happens on Discord &mdash; this app never sees your password.</p>
  </div>
</div>

<!-- ============ SVG ICON LIBRARY ============ -->''', tag='2-lock-html')

# ---------- 3. discord icon into the sprite ----------
rep('<symbol id="i-chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></symbol>',
    '<symbol id="i-chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></symbol>'
    '<symbol id="i-discord" viewBox="0 0 24 24">'
    '<path fill="#5865F2" stroke="none" d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.04.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.11 13 13 0 0 1-1.87-.89.08.08 0 0 1-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 0 1 .08-.01c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08.01c.12.1.25.2.38.29a.08.08 0 0 1-.01.13c-.6.35-1.22.64-1.87.88a.08.08 0 0 0-.04.12c.36.7.77 1.36 1.22 1.99a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.02-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03zM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42z"/>'
    '</symbol>', tag='3-discord-icon')

# ---------- 4. JS: gate module at the top of the main app script ----------
rep('<script>/* ===== SOURCE GUARD', '''<script>/* ===== discord gate (members only) ===== */
(function(){
  const ERRS = {
    setup:   'The gate is not configured yet \\u2014 the owner still needs to finish the Discord setup on the server.',
    state:   'Verification session expired or invalid \\u2014 tap Verify with Discord and try again.',
    join:    'You are not in the XR server yet. Join it, take the XR-Auth role, then verify again.',
    pending: 'Your membership is still pending \\u2014 finish server verification, then tap Verify again.',
    role:    'You need the XR-Auth role in the XR server to use the AI. Ask an admin, then verify again.',
    roleconf:'The role check cannot run right now (gate configuration). Access stays closed \\u2014 the owner needs to pin the XR-Auth role id.',
    verify:  'Verification could not be completed \\u2014 please try again.',
    expired: 'Verification expired (30 days) \\u2014 verify again to continue.',
    bad:     'Invalid verification cookie \\u2014 verify again.',
    none:    ''
  };
  const lock = document.getElementById('dsLock');
  const errBox = document.getElementById('dsErr');
  const btn = document.getElementById('dsBtn');
  const inv = document.getElementById('dsInvite');
  let verified = false, uid = '', busy = false;

  function show(code){
    lock.hidden = false;
    const c = code || 'none';
    errBox.textContent = ERRS[c] || ERRS.verify;
    errBox.hidden = (c === 'none');
  }
  function hide(){ lock.hidden = true; }
  window.dsShowLock = show;
  window.dsHideLock = hide;

  btn.addEventListener('click', () => { window.location.href = '/auth/discord/start'; });

  function accRow(){
    const r = document.createElement('div'); r.className = 'acc-row';
    const i = document.createElement('div'); i.className = 'ai2';
    const n = document.createElement('div'); n.className = 'an'; n.textContent = verified ? 'Discord verified' : 'Not verified';
    const st = document.createElement('div'); st.className = 'as';
    st.textContent = verified ? ('Member gate active \\u00b7 ' + String(uid).slice(0, 6) + '\\u2026') : 'XR-Auth role members only';
    const b = document.createElement('button'); b.className = 'st-skip'; b.type = 'button';
    b.textContent = verified ? 'Un-verify' : 'Verify with Discord';
    b.onclick = async () => {
      if(verified){
        try{ await fetch(API_BASE + '/api/discord/logout', { method: 'POST' }); }catch(e){}
        verified = false; uid = '';
        toast('Un-verified \\u2014 the members gate is back on');
        setTimeout(check, 400);
      } else {
        window.location.href = '/auth/discord/start';
      }
    };
    i.append(n, st); r.append(i, b);
    return r;
  }
  window.dsAccRow = accRow;

  async function check(){
    if(busy) return; busy = true;
    try{
      const res = await fetch(API_BASE + '/api/discord/check', { method: 'POST', cache: 'no-store' });
      const d = await res.json().catch(() => null);
      if(d && d.invite){ inv.href = d.invite; inv.hidden = false; } else { inv.hidden = true; }
      if(d && d.ok){ verified = true; uid = d.uid || ''; hide(); }
      else { verified = false; show(d && d.error || 'none'); }
    }catch(e){ /* server unreachable \\u2014 never lock on a network error; the send path re-checks via 401 */ }
    busy = false;
  }

  setTimeout(() => {
    const q = new URLSearchParams(location.search);
    if(q.get('dserr')){
      show(q.get('dserr'));
      history.replaceState(null, '', location.pathname);
    } else if(q.get('dsok')){
      toast('Verified \\u2014 welcome back');
      history.replaceState(null, '', location.pathname);
    }
    check();
  }, 350);
})();
/* ===== SOURCE GUARD''', tag='4-gate-js')

# ---------- 5. chat send: 401 -> lock ----------
rep('''      d = await res.json().catch(() => null);
      if(d && d.ok && (d.text || '').trim()) break;''',
'''      d = await res.json().catch(() => null);
      if(res.status === 401 && d && d.error === 'auth'){        // members gate bounced this send
        chip.textContent = 'Hosted by Z.ai'; pen.remove();
        window.dsShowLock(d.auth); return;
      }
      if(d && d.ok && (d.text || '').trim()) break;''', tag='5-chat-401')

# ---------- 6. imagine send: 401 -> lock (no retry loop on auth) ----------
rep('''        d = await res.json().catch(() => null);
        if(!(d && d.ok)) d = null;''',
'''        d = await res.json().catch(() => null);
        if(res.status === 401 && d && d.error === 'auth'){      // members gate bounced this painting
          chip.textContent = 'Hosted by Z.ai'; pen.remove();
          window.dsShowLock(d.auth); return;
        }
        if(!(d && d.ok)) d = null;''', tag='6-imagine-401')

# ---------- 7. account panel: discord status row ----------
rep("""  s.textContent = 'Chats save automatically on this device · ' + (NET.live ? 'Hosted by Z.ai' : 'offline');
  i.append(n, s);
  r.append(i); box.append(r);
}""",
'''  s.textContent = 'Chats save automatically on this device · ' + (NET.live ? 'Hosted by Z.ai' : 'offline');
  i.append(n, s);
  r.append(i); box.append(r);
  if(window.dsAccRow) box.append(window.dsAccRow());
}''', tag='7-acc-row')

open(P, 'w', encoding='utf-8').write(s)
print(f'done: {orig_len} -> {len(s)} bytes (+{len(s)-orig_len})')
