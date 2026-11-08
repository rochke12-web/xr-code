#!/usr/bin/env python3
"""no_recents.py — remove the "Recent chats" sidebar section from XR CODE (idempotent):
- "Recent chats" heading + chat list gone
- "Search chats" nav button + its filter box gone (they only filtered the recents list)
- renderChats(), seedChats() and all dead CSS (.chat-list/.chat-item/.chat-search/.list-empty)
  removed; the chat data model itself stays (it powers the actual chat view).
Edits download/xr-code.html in place; safe to re-run.
"""
import os, re, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-norecents.html"

src = open(F, encoding="utf-8").read()

if "no_recents" in src or ("chatList" not in src and "seedChats" not in src and "btnSearch" not in src):
    # already patched — still run the full sanity pass before exiting
    clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
    dead = ["Recent chats", "chatList", "renderChats", "chatSearch", "btnSearch",
            "Search chats", "chat-item", "chat-list", "list-empty", "seedChats",
            "chat-search", "i-search"]
    left = [d for d in dead if d in clean]
    if left:
        print("SANITY FAILED — leftovers:", left); sys.exit(1)
    js0 = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf0:
        tf0.write(js0); tmp0 = tf0.name
    r0 = subprocess.run(["node", "--check", tmp0], capture_output=True, text=True)
    os.unlink(tmp0)
    if r0.returncode != 0:
        print("JS SYNTAX ERROR:\n" + r0.stderr[:2000]); sys.exit(1)
    if "netCheck" not in src or "/api/chat" not in src:
        print("SANITY FAILED — hosted brain missing"); sys.exit(1)
    print("already patched — sanity pass OK")
    sys.exit(0)

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    if n != count:
        fails.append(f"[{tag}] anchor found {n}x (expected {count}): {old[:90]!r}")
        return
    src = src.replace(old, new)

# ============ HTML ============

# 1. sidebar nav — drop the Search chats button (it only filtered the recents list)
rep('      <button id="btnSearch" type="button"><svg class="ic"><use href="#i-search"/></svg> Search chats</button>\n',
    '', "btnSearch")

# 2. sidebar — drop search box + "Recent chats" heading + list
rep('''    <div class="chat-search" id="chatSearchWrap">
      <input id="chatSearch" autocomplete="off" placeholder="Search your chats...">
    </div>

    <div class="side-head" style="padding-top:10px">Recent chats</div>
    <div class="chat-list" id="chatList"></div>

  </aside>''',
    '  </aside>', "sidebar-list")

# 3. unused search icon symbol
rep('  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></symbol>\n',
    '', "i-search-def")

# ============ CSS ============

# 4. dead styles for the removed list / search
rep('''.chat-search{padding:8px 16px 4px;display:none}
.chat-search.open{display:block}
.chat-search input{
  width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:10px;
  padding:8px 12px;font-size:12.5px;outline:none;
}
.chat-search input:focus{border-color:var(--accent)}

.chat-list{flex:1;overflow-y:auto;min-height:60px;padding:6px 10px;display:flex;flex-direction:column;gap:2px}
.chat-item{
  display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;
  padding:8px 11px;border-radius:10px;font-size:12.5px;text-align:left;color:var(--text);
}
.chat-item:hover{background:var(--panel-2)}
.chat-item.active{background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line)}
.chat-item .ct{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-item .cm{font-size:10.5px;color:var(--muted);white-space:nowrap;font-family:var(--font-mono)}
.list-empty{padding:14px;font-size:12px;color:var(--muted);text-align:center}

''', '', "dead-css")

# ============ JS ============

# 5. seed chats existed only to fill the recents list — no longer needed
rep('''function seedChats(){
  return [
    { id: uid(), title: 'Python Script Help',   ts: now() - 2 * 36e5,  messages: [] },
    { id: uid(), title: 'C++ Optimization',     ts: now() - 26 * 36e5, messages: [] },
    { id: uid(), title: 'Build a Website Plan', ts: now() - 2 * 864e5, messages: [] },
    { id: uid(), title: 'Code Explain',         ts: now() - 3 * 864e5, messages: [] },
    { id: uid(), title: 'Website Project',      ts: now() - 4 * 864e5, messages: [] }
  ];
}
function defaults(){
  return {
    theme: 'dark',
    user: null,              // optional Google/Discord link — only marks chats as synced
    chats: seedChats(),''',
    '''function defaults(){
  return {
    theme: 'dark',
    user: null,              // optional Google/Discord link — only marks chats as synced
    chats: [],''', "seedChats")

# 6. chat view is its own space — no nav button highlights it anymore
rep('''  $$('#btnHome,#btnSearch,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));
  if(name === 'home') $('#btnHome').classList.add('current');
  if(name === 'chat') $('#btnSearch').classList.add('current');
  if(name === 'settings') $('#btnSettings').classList.add('current');''',
    '''  $$('#btnHome,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));
  if(name === 'home') $('#btnHome').classList.add('current');
  if(name === 'settings') $('#btnSettings').classList.add('current');''', "showView")

# 7. drop renderChats() — only ago/agoFull time labels remain in this block
rep('''/* ---------- chat list (with search) ---------- */
function ago(ts){''',
    '''/* ---------- time labels ---------- */
function ago(ts){''', "ago-header")

rep('''function renderChats(q){
  q = (q || '').toLowerCase();
  const list = $('#chatList'); list.innerHTML = '';
  const items = S.chats
    .filter(c => c.title.toLowerCase().includes(q))
    .sort((a, b) => b.ts - a.ts);
  if(!items.length){
    const d = document.createElement('div');
    d.className = 'list-empty';
    d.textContent = q ? 'No chats match "' + q + '"' : 'No chats yet — make a project';
    list.append(d); return;
  }
  items.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chat-item' + (c.id === S.active ? ' active' : '');
    const t = document.createElement('span'); t.className = 'ct'; t.textContent = c.title;
    const m = document.createElement('span'); m.className = 'cm';
    m.textContent = ago(c.ts) + (S.user ? ' \\u2601' : '');
    b.append(t, m);
    b.onclick = () => { S.active = c.id; save(); showView('chat'); };
    list.append(b);
  });
}

/* ---------- chat view ---------- */''',
    '/* ---------- chat view ---------- */', "renderChats")

# 8. sendMsg — no list refresh
rep('  renderChat(); save(); renderChats($(\'#chatSearch\').value);\n',
    '  renderChat(); save();\n', "sendMsg")

# 9. typeReply — no list refresh
rep('      save(); renderChats($(\'#chatSearch\').value);\n',
    '      save();\n', "typeReply")

# 10. clearAll — no list refresh
rep('  S = defaults(); applyTheme(); renderChats(); renderChat(); renderAccounts();',
    '  S = defaults(); applyTheme(); renderChat(); renderAccounts();', "clearAll")

# 11. wire-up — btnSearch handler gone, btnProject no longer refreshes the list
rep('''$('#btnHome').onclick = () => showView('home');
$('#btnSearch').onclick = () => {
  const w = $('#chatSearchWrap');
  w.classList.toggle('open');
  if(w.classList.contains('open')){ showView('chat'); $('#chatSearch').focus(); }
};
$('#btnProject').onclick = () => { S.active = null; save(); showView('chat'); renderChats(); $('#chatInput').focus(); toast('New project started'); };''',
    '''$('#btnHome').onclick = () => showView('home');
$('#btnProject').onclick = () => { S.active = null; save(); showView('chat'); $('#chatInput').focus(); toast('New project started'); };''',
    "wireup")

# 12. search input listener gone
rep("\n$('#chatSearch').addEventListener('input', e => renderChats(e.target.value));\n", '', "search-listener")

# 13. init — no list to render
rep('''applyTheme();
renderChats();
renderAccounts();''',
    '''applyTheme();
renderAccounts();''', "init")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
dead = ["Recent chats", "chatList", "renderChats", "chatSearch", "btnSearch",
        "Search chats", "chat-item", "chat-list", "list-empty", "seedChats",
        "chat-search", "i-search"]
left = [d for d in dead if d in clean]
if left:
    print("SANITY FAILED — leftovers:", left); sys.exit(1)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

for keep in ["netCheck", "/api/chat", "askBrain", "renderAccounts", "Workspace", "side-head"]:
    if keep not in clean:
        print("SANITY FAILED — lost:", keep); sys.exit(1)

print("OK — recents chat removed, sanity + node --check pass, bytes:", len(src.encode("utf-8")))
