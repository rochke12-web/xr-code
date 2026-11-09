#!/usr/bin/env python3
# discord_oauth.py — real Discord OAuth progress saving (client side).
# Link → /auth/discord/start (server-driven code flow), chats auto-backup
# (debounced) to the linked account, restore on empty devices. Idempotent.
import re, shutil

SRC = '/home/z/my-project/download/xr-code.html'
shutil.copyfile(SRC, '/home/z/my-project/scripts/xr-pre-discord.html')

src = open(SRC, encoding='utf-8').read()

def rep(out, old, new, n=1):
    c = out.count(old)
    assert c == n, f'anchor x{c} (want x{n}): {old[:90]!r}'
    return out.replace(old, new)

out = src

# ---- E1: avatar CSS
out = rep(out,
""".acc-row .as{font-size:11.5px;color:var(--muted)}""",
""".acc-row .as{font-size:11.5px;color:var(--muted)}
.acc-row .avatar{width:36px;height:36px;border-radius:50%;flex:none;object-fit:cover;border:1px solid var(--line)}""")

# ---- E2: real OAuth login (was a fake local marker)
out = rep(out,
"""function login(provider){                            // optional account link (chat sync only)
  S.user = { provider: 'discord', name: 'Yug and Saksham (Discord)' };
  S.lastSync = now();
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Linked Discord — chats are marked as synced');
}""",
"""function login(provider){                            // real Discord OAuth — the server runs the flow
  if(provider === 'discord'){
    if(!API_BASE){ toast('Open XR-Code on its hosted site to link Discord'); return; }
    window.top.location.href = API_BASE + '/auth/discord/start';
    return;
  }
}""")

# ---- E3: logout also drops the server session
out = rep(out,
"""function logout(){
  S.user = null; S.lastSync = null;
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Unlinked — chats keep saving in this browser');
}""",
"""function logout(){
  S.user = null; S.lastSync = null;
  if(API_BASE){ try{ fetch(API_BASE + '/api/discord/logout', { method: 'POST' }); }catch(e){} }
  save(); renderAccounts(); renderChat(); updateSyncUI();
  toast('Unlinked — chats keep saving in this browser');
}""")

# ---- E4: save() gains debounced cloud push
out = rep(out,
"""function save(){ try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} updateSyncUI(); renderStatus(); }""",
"""let __syncT = 0;
function save(){ try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){} updateSyncUI(); renderStatus(); queueSync(); }
function queueSync(){                                // keep the Discord cloud copy fresh (debounced)
  if(!S.user || !API_BASE) return;
  clearTimeout(__syncT);
  __syncT = setTimeout(pushProgress, 2500);
}
async function pushProgress(){                       // back up chats to the linked account
  if(!S.user || !API_BASE) return;
  try{
    const r = await fetch(API_BASE + '/api/progress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chats: S.chats, active: S.active }) });
    if(r.ok){
      S.lastSync = now();
      try{ localStorage.setItem(LSKEY, JSON.stringify(S)); }catch(e){}
      renderAccounts(); updateSyncUI();
    }
  }catch(e){}
}""")

# ---- E5: renderAccounts — avatar + honest sync status
out = rep(out,
"""  if(S.user){
    const r = document.createElement('div'); r.className = 'acc-row';
    const i = document.createElement('div'); i.className = 'ai2';
    const n = document.createElement('div'); n.className = 'an'; n.textContent = S.user.name;
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Chats sync to ' + providerLabel(S.user.provider) +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : '') +
      ' · engine: ' + (NET.live ? 'XR Code AI (live)' : 'XR Code AI (offline)');
    i.append(n, s);""",
"""  if(S.user){
    const r = document.createElement('div'); r.className = 'acc-row';
    const av = document.createElement('img'); av.className = 'avatar'; av.alt = '';
    av.src = S.user.avatar
      ? 'https://cdn.discordapp.com/avatars/' + S.user.id + '/' + S.user.avatar + '.png?size=64'
      : 'https://cdn.discordapp.com/embed/avatars/0.png';
    const i = document.createElement('div'); i.className = 'ai2';
    const n = document.createElement('div'); n.className = 'an'; n.textContent = S.user.name;
    const s = document.createElement('div'); s.className = 'as';
    s.textContent = 'Chats sync to your Discord account' +
      (S.lastSync ? ' · last sync ' + agoFull(S.lastSync) : ' · not synced yet') +
      ' · engine: ' + (NET.live ? 'XR Code AI (live)' : 'XR Code AI (offline)');
    i.append(n, s);""")

# ---- E6: Sync now — push, or pull when this device is empty
out = rep(out,
"""$('#syncNowBtn').onclick = () => {
  if(!S.user){ toast('Linking Discord (Settings) is optional — chats already save in this browser'); return; }
  S.lastSync = now(); save(); renderAccounts();
  toast('Chats synced to ' + providerLabel(S.user.provider));
};""",
"""$('#syncNowBtn').onclick = async () => {
  if(!S.user){ toast('Linking Discord (Settings) is optional — chats already save in this browser'); return; }
  try{
    const p = await fetch(API_BASE + '/api/progress', { cache: 'no-store' });
    const pd = await p.json();
    if(pd && pd.ok && pd.chats && Array.isArray(pd.chats.chats) && pd.chats.chats.length && (!S.chats || !S.chats.length)){
      S.chats = pd.chats.chats;                      // this device was empty — pull the cloud copy down
      S.active = (pd.chats.active != null) ? pd.chats.active : 0;
      renderChat();
    }
  }catch(e){}
  pushProgress();
  toast('Chats synced to your Discord account');
};""")

# ---- E7: bootSync + hook into init
out = rep(out,
"""/* ---------- init ---------- */
applyTheme();""",
"""async function bootSync(){                          // Discord session + cloud progress restore
  if(!API_BASE) return;
  try{
    const r = await fetch(API_BASE + '/api/session', { cache: 'no-store' });
    const d = await r.json();
    if(!(d && d.user)) return;
    S.user = { provider: 'discord', id: d.user.id, name: d.user.name, avatar: d.user.avatar };
    const p = await fetch(API_BASE + '/api/progress', { cache: 'no-store' });
    const pd = await p.json();
    if(pd && pd.ok && pd.chats && Array.isArray(pd.chats.chats) && pd.chats.chats.length && (!S.chats || !S.chats.length)){
      S.chats = pd.chats.chats;
      S.active = (pd.chats.active != null) ? pd.chats.active : 0;
      renderChat();
      toast('Restored ' + S.chats.length + ' chats from your Discord account');
    }
    save(); renderAccounts();
  }catch(e){}
}

/* ---------- init ---------- */
applyTheme();""")

out = rep(out,
"""netCheck();                                         // ping the hosted brain once for the status bar
$('#chatInput').disabled = false;""",
"""netCheck();                                         // ping the hosted brain once for the status bar
bootSync();                                         // pick up the Discord session + restore cloud progress
$('#chatInput').disabled = false;""")

# ---- E8: settings note tells the truth now
out = rep(out,
"""it only marks your chats as saved to that account""",
"""it backs up your chats to your Discord account and restores them on any device""")

# ---- assertions
assert out.count('/auth/discord/start') == 1
assert out.count('/api/discord/logout') == 1
assert out.count('/api/progress') == 3          # pushProgress + syncNow + bootSync
assert out.count('/api/session') == 1
assert out.count('function bootSync(') == 1
assert out.count('bootSync();') == 1
assert out.count('.acc-row .avatar') == 1
assert out.count('Yug and Saksham (Discord)') == 0
assert out.count('cdn.discordapp.com/avatars') == 1
assert out.count('queueSync') == 2              # def + call in save

open(SRC, 'w', encoding='utf-8').write(out)

m = re.search(r'<script>(.*)</script>', out, re.S)
open('/tmp/xr_discord_check.js', 'w', encoding='utf-8').write(m.group(1))
print('OK — Discord OAuth client wiring done, snapshot at scripts/xr-pre-discord.html')
