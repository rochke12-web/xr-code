#!/usr/bin/env python3
"""ux_upgrade.py — three features for XR CODE (idempotent):
1. sidebar resizer: drag handle between sidebar and main (width saved to localStorage)
2. "Search" nav button under Home: searches old chats AND code, jumps to the hit
3. chat animation like modern AI chats: thinking-dots bubble while waiting,
   then streaming reply with blinking cursor
Edits download/xr-code.html in place; safe to re-run.
"""
import os, re, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-ux.html"

src = open(F, encoding="utf-8").read()

if 'id="resizer"' in src and "runSearch" in src:
    js0 = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf0:
        tf0.write(js0); tmp0 = tf0.name
    r0 = subprocess.run(["node", "--check", tmp0], capture_output=True, text=True)
    os.unlink(tmp0)
    if r0.returncode != 0:
        print("JS SYNTAX ERROR:\n" + r0.stderr[:2000]); sys.exit(1)
    print("already patched — sanity pass OK")
    sys.exit(0)

if not os.path.exists(SNAP):
    shutil.copy(F, SNAP)

fails = []
def rep(old, new, tag, count=1):
    global src
    n = src.count(old)
    if n != count:
        fails.append(f"[{tag}] anchor found {n}x (expected {count}): {old[:80]!r}")
        return
    src = src.replace(old, new)

# ============ 1. CSS ============

# search panel + result rows + hit highlight + thinking dots + stream cursor
rep('.nav .ic{flex:none}',
    '''.nav .ic{flex:none}
.chat-search{padding:10px 12px 4px;display:none}
.chat-search.open{display:block}
.chat-search input{
  width:100%;background:var(--bg2);border:1px solid var(--line);border-radius:10px;
  padding:8px 12px;font-size:12.5px;outline:none;color:var(--text);
}
.chat-search input:focus{border-color:var(--accent)}
.search-list{flex:1;overflow-y:auto;min-height:60px;padding:8px 10px;display:flex;flex-direction:column;gap:2px}
.sr-item{display:block;width:100%;text-align:left;padding:8px 10px;border-radius:10px;transition:background .15s}
.sr-item:hover{background:var(--panel-2)}
.sr-item .st{display:block;font-size:12.5px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sr-item .sx{display:block;font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;font-family:var(--font-mono)}
.sr-empty{padding:14px;font-size:12px;color:var(--muted);text-align:center}
.msg.hit .bubble{box-shadow:0 0 0 1.5px var(--accent)}
.dots{display:inline-flex;gap:5px;padding:7px 2px 3px}
.dots i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:dotB 1.2s infinite}
.dots i:nth-child(2){animation-delay:.15s}
.dots i:nth-child(3){animation-delay:.3s}
@keyframes dotB{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
.stream-cursor{display:inline-block;width:8px;height:14px;margin-left:2px;vertical-align:-2px;background:var(--accent);animation:curB .8s steps(1) infinite}
@keyframes curB{50%{opacity:0}}
.resizer{width:6px;flex:none;order:-1;cursor:col-resize;background:transparent;transition:background .15s}
.resizer:hover,.resizer.drag{background:var(--accent)}''', "css-block")

# hide the resizer on mobile (sidebar stacks)
rep('  .sidebar{width:100%;border-right:none;border-top:1px solid var(--line);max-height:46vh;order:2}',
    '  .sidebar{width:100%;border-right:none;border-top:1px solid var(--line);max-height:46vh;order:2}\n  .resizer{display:none}', "mq-resizer")

# ============ 2. HTML ============

# search icon back in the library
rep('  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></symbol>',
    '''  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></symbol>''', "i-search-def")

# Search button under Home
rep('      <button id="btnHome" class="current" type="button"><svg class="ic"><use href="#i-home"/></svg> Home</button>',
    '''      <button id="btnHome" class="current" type="button"><svg class="ic"><use href="#i-home"/></svg> Home</button>
      <button id="btnSearch" type="button"><svg class="ic"><use href="#i-search"/></svg> Search</button>''', "btn-search")

# search panel + results list in the sidebar
rep('''    </nav>

  </aside>''',
    '''    </nav>

    <div class="chat-search" id="chatSearchWrap">
      <input id="chatSearch" autocomplete="off" placeholder="Search old code & chats...">
    </div>
    <div class="search-list" id="searchResults"></div>

  </aside>''', "search-html")

# resizer handle between sidebar and main
rep('''  </aside>
</div>

<!-- ============ STATUS BAR ============ -->''',
    '''  </aside>

  <div class="resizer" id="resizer" title="Drag to resize the sidebar"></div>
</div>

<!-- ============ STATUS BAR ============ -->''', "resizer-html")

# ============ 3. JS ============

# search button participates in nav highlight
rep("$$('#btnHome,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));",
    "$$('#btnHome,#btnSearch,#btnProject,#btnSettings').forEach(b => b.classList.remove('current'));", "nav-strip")

# search logic
rep('/* ---------- wire up ---------- */',
    '''/* ---------- search old chats & code ---------- */
function runSearch(q){
  const list = $('#searchResults'); list.innerHTML = '';
  q = (q || '').trim().toLowerCase();
  if(!q){
    const d = document.createElement('div'); d.className = 'sr-empty';
    d.textContent = 'Type to search your old chats and code';
    list.append(d); return;
  }
  let hits = 0;
  outer:
  for(const c of S.chats){
    for(let mi = 0; mi < c.messages.length; mi++){
      const m = c.messages[mi];
      const hay = ((m.t || '') + '\\n' + (m.code || '')).toLowerCase();
      if(hay.indexOf(q) < 0) continue;
      hits++;
      const inCode = (m.code || '').toLowerCase().includes(q) && !(m.t || '').toLowerCase().includes(q);
      const raw = (inCode ? '[code] ' + (m.code || '').replace(/\\s+/g, ' ') : (m.t || '').replace(/\\s+/g, ' '));
      const ridx = raw.toLowerCase().indexOf(q);
      const start = Math.max(0, ridx - 32), end = ridx + q.length + 40;
      const snip = (start > 0 ? '\\u2026' : '') + raw.slice(start, end) + (end < raw.length ? '\\u2026' : '');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'sr-item';
      const t = document.createElement('span'); t.className = 'st'; t.textContent = c.title;
      const x = document.createElement('span'); x.className = 'sx'; x.textContent = snip;
      b.append(t, x);
      b.onclick = () => {
        S.active = c.id; save();
        showView('chat');
        $('#chatSearchWrap').classList.remove('open');
        requestAnimationFrame(() => {
          const el = $$('#msgs .msg')[mi];
          if(el){
            el.scrollIntoView({ block: 'center' });
            el.classList.add('hit');
            setTimeout(() => el.classList.remove('hit'), 1800);
          }
        });
      };
      list.append(b);
      if(hits >= 40) break outer;
    }
  }
  if(!hits){
    const d = document.createElement('div'); d.className = 'sr-empty';
    d.textContent = 'No matches for "' + q + '"';
    list.append(d);
  }
}

/* ---------- wire up ---------- */''', "search-js")

# search handlers
rep("$('#btnProject').onclick = () => { S.active = null; save(); showView('chat'); $('#chatInput').focus(); toast('New project started'); };",
    """$('#btnProject').onclick = () => { S.active = null; save(); showView('chat'); $('#chatInput').focus(); toast('New project started'); };
$('#btnSearch').onclick = () => {
  const w = $('#chatSearchWrap');
  w.classList.toggle('open');
  if(w.classList.contains('open')){ $('#chatSearch').focus(); runSearch($('#chatSearch').value); }
};
$('#chatSearch').addEventListener('input', e => runSearch(e.target.value));

/* ---------- sidebar resizer ---------- */
(function(){
  const bar = document.querySelector('.sidebar'), rz = $('#resizer');
  if(S.sidebarW) bar.style.width = S.sidebarW + 'px';
  let on = false;
  rz.addEventListener('pointerdown', e => { on = true; rz.classList.add('drag'); document.body.style.cursor = 'col-resize'; e.preventDefault(); });
  window.addEventListener('pointermove', e => {
    if(!on) return;
    const w = Math.max(210, Math.min(460, e.clientX));
    bar.style.width = w + 'px';
    S.sidebarW = w;
  });
  window.addEventListener('pointerup', () => {
    if(!on) return;
    on = false; rz.classList.remove('drag'); document.body.style.cursor = '';
    save();
  });
})();""", "wire-add")

# typeReply: thinking dots cleared, streaming cursor, only render on-screen chat
rep('''function typeReply(c, reply, live){
  const box = $('#msgs');
  const el = document.createElement('div'); el.className = 'msg a';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = 'XR CODE';
  const body = document.createElement('div'); body.className = 'bubble';
  const chip = document.createElement('span'); chip.className = 'chip';
  chip.textContent = 'engine: ' + (live ? 'live' : 'Prime AI');
  el.append(who, body, chip); box.append(el);
  box.scrollTop = box.scrollHeight;

  let i = 0;
  const iv = setInterval(() => {
    if(!document.contains(el)){           // user switched chats while typing
      clearInterval(iv);
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });
      save(); return;
    }
    i += 3;
    body.textContent = reply.text.slice(0, i);
    box.scrollTop = box.scrollHeight;
    if(i >= reply.text.length){
      clearInterval(iv);
      body.textContent = reply.text;
      if(reply.code){
        const pre = document.createElement('pre'); pre.textContent = reply.code; el.append(pre);
      }
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });
      c.ts = now();
      save();
    }
  }, 14);
}''',
    '''function typeReply(c, reply, live, pen){
  const box = $('#msgs');
  if(pen && pen.parentNode) pen.remove();       // clear the thinking-dots bubble
  const el = document.createElement('div'); el.className = 'msg a';
  const who = document.createElement('span'); who.className = 'who'; who.textContent = 'XR CODE';
  const body = document.createElement('div'); body.className = 'bubble';
  const chip = document.createElement('span'); chip.className = 'chip';
  chip.textContent = 'engine: ' + (live ? 'live' : 'Prime AI');
  el.append(who, body, chip);
  if(currentChat().id === c.id) box.append(el);  // only show when this chat is on screen
  box.scrollTop = box.scrollHeight;

  const cur = document.createElement('span'); cur.className = 'stream-cursor';
  let i = 0;
  const iv = setInterval(() => {
    if(!document.contains(el)){           // user switched chats while typing
      clearInterval(iv);
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });
      save(); return;
    }
    i += 3;
    body.textContent = reply.text.slice(0, i);
    body.append(cur);
    box.scrollTop = box.scrollHeight;
    if(i >= reply.text.length){
      clearInterval(iv);
      cur.remove();
      body.textContent = reply.text;
      if(reply.code){
        const pre = document.createElement('pre'); pre.textContent = reply.code; el.append(pre);
      }
      c.messages.push({ r: 'a', t: reply.text, code: reply.code, m: live ? 'live' : 'demo' });
      c.ts = now();
      save();
    }
  }, 14);
}''', "typeReply")

# askBrain: show animated thinking-dots bubble while waiting
rep('''async function askBrain(c, text){
  const chip = $('#chatModelChip');
  chip.textContent = 'engine: live \\u00b7 thinking\\u2026';
  try{'''.replace('\\u00b7', '·').replace('\\u2026', '…'),
    '''async function askBrain(c, text){
  const chip = $('#chatModelChip');
  chip.textContent = 'engine: live · thinking…';
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
  try{''', "askBrain-head")

rep("    typeReply(c, { text: t }, true);",
    "    typeReply(c, { text: t }, true, pen);", "askBrain-ok")

rep("      typeReply(c, genReply(text), false);               // local file preview — built-in Prime AI",
    "      typeReply(c, genReply(text), false, pen);          // local file preview — built-in Prime AI", "askBrain-demo")

rep("      typeReply(c, { text: 'The AI server is unreachable right now — check your connection and try again in a moment.' }, false);",
    "      typeReply(c, { text: 'The AI server is unreachable right now — check your connection and try again in a moment.' }, false, pen);",
    "askBrain-err")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
for keep in ['id="resizer"', "runSearch", "btnSearch", "chatSearchWrap", "searchResults",
             "i-search", "dots", "stream-cursor", "sidebarW", "chat-search", "sr-item",
             "netCheck", "/api/chat", "askBrain"]:
    if keep not in clean:
        print("SANITY FAILED — missing:", keep); sys.exit(1)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — resizer + search + AI animation in, bytes:", len(src.encode("utf-8")))
