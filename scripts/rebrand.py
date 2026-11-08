#!/usr/bin/env python3
"""rebrand.py — XR CODE polish pass (idempotent):
- remove the 4 quick cards (Generate Code / Get Ideas / Debug Code / Build Something)
  + their CSS, JS handler and the now-unused #i-arrow icon
- offline/demo brain is rebranded "Prime AI": status text, chip, account line
- "Made by YUX FF" -> "Made by Yug and Saksham" (topbar, footer, title, login names)
Edits download/xr-code.html in place; safe to re-run.
"""
import os, re, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-rebrand.html"

src = open(F, encoding="utf-8").read()

if "quickCards" not in src and "Prime AI" in src:
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

# ============ 1. remove the quick cards (HTML) ============
rep('''        <div class="quick" id="quickCards">
          <button class="card" data-q="Generate code: write a Python script that renames all files in a folder to lowercase.">
            <span class="ct">Generate Code</span>
            <span class="cd">Write, improve or explain code in any language.</span>
            <span class="go"><svg class="ic small"><use href="#i-arrow"/></svg></span>
          </button>
          <button class="card" data-q="Give me ideas for a small project I can build this weekend.">
            <span class="ct">Get Ideas</span>
            <span class="cd">Explore programming ideas and project plans.</span>
            <span class="go"><svg class="ic small"><use href="#i-arrow"/></svg></span>
          </button>
          <button class="card" data-q="Debug this: my JavaScript function returns undefined instead of the fetched data.">
            <span class="ct">Debug Code</span>
            <span class="cd">Find and fix errors fast.</span>
            <span class="go"><svg class="ic small"><use href="#i-arrow"/></svg></span>
          </button>
          <button class="card" data-q="Build: a landing page for my portfolio website.">
            <span class="ct">Build Something</span>
            <span class="cd">Turn an idea into a real project.</span>
            <span class="go"><svg class="ic small"><use href="#i-arrow"/></svg></span>
          </button>
        </div>

        <span class="ver">''',
    '        <span class="ver">', "cards-html")

# ============ 2. remove cards CSS ============
rep('''
/* quick cards */
.quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;width:min(860px,100%)}
.card{
  text-align:left;border:1px solid var(--line);border-radius:var(--radius);
  background:var(--panel);padding:16px;display:flex;flex-direction:column;gap:6px;
  transition:transform .18s ease,border-color .18s,background .18s;
}
.card:hover{transform:translateY(-3px);border-color:var(--accent);background:var(--panel-2)}
.card .ct{font-weight:600;font-size:14px}
.card .cd{font-size:12px;color:var(--muted);line-height:1.45;flex:1}
.card .go{
  align-self:flex-end;width:26px;height:26px;display:grid;place-items:center;border-radius:8px;
  border:1px solid var(--line);color:var(--accent);
}
''', '\n', "cards-css")

rep('  .quick{grid-template-columns:repeat(2,1fr)}\n', '', "cards-css-mobile")

# ============ 3. remove cards JS + unused icon ============
rep("$$('#quickCards .card').forEach(c => c.onclick = () => { S.active = null; sendMsg(c.dataset.q); });\n",
    '', "cards-js")
rep('  <symbol id="i-arrow" viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></symbol>\n',
    '', "i-arrow-def")

# ============ 4. Prime AI (offline / fallback brain) ============
rep("                           : 'AI offline — demo brain';",
    "                           : 'Prime AI';", "status-offline")

rep("      ' · engine: ' + (NET.live ? 'XR CODE AI (live)' : 'XR Core (demo)');",
    "      ' · engine: ' + (NET.live ? 'XR CODE AI (live)' : 'Prime AI');", "acc-offline")

rep("    chip.textContent = 'engine: ' + (m.m === 'XR Core' || m.m === 'demo' ? 'demo' : 'live');",
    "    chip.textContent = 'engine: ' + (m.m === 'XR Core' || m.m === 'demo' ? 'Prime AI' : 'live');", "chip-old-msgs")

rep("  chip.textContent = 'engine: ' + (live ? 'live' : 'demo');",
    "  chip.textContent = 'engine: ' + (live ? 'live' : 'Prime AI');", "chip-type")

rep("    chip.textContent = 'engine: demo';",
    "    chip.textContent = 'engine: Prime AI';", "chip-catch")

rep('/* ---------- canned replies (demo brain) ---------- */',
    '/* ---------- canned replies (Prime AI fallback) ---------- */', "cmt-canned")
rep("      typeReply(c, genReply(text), false);               // local file preview — built-in demo brain",
    "      typeReply(c, genReply(text), false);               // local file preview — built-in Prime AI", "cmt-fallback")

# ============ 5. Made by Yug and Saksham ============
rep('<title>XR CODE — by YUX FF</title>',
    '<title>XR CODE — by Yug and Saksham</title>', "title")
rep('XR CODE — single-file UI  |  Made by YUX FF  |  v1.0.0',
    'XR CODE — single-file UI  |  Made by Yug and Saksham  |  v1.0.0', "hdr-cmt")
rep('<span class="made">Made by <b>YUX FF</b></span>',
    '<span class="made">Made by <b>Yug and Saksham</b></span>', "topbar-made")
rep('  <span>Made by <b>YUX FF</b></span>',
    '  <span>Made by <b>Yug and Saksham</b></span>', "footer-made")
rep("? { provider: 'google',   name: 'YUX FF (Google)' }",
    "? { provider: 'google',   name: 'Yug and Saksham (Google)' }", "login-g")
rep(": { provider: 'discord',  name: 'YUX FF (Discord)' };",
    ": { provider: 'discord',  name: 'Yug and Saksham (Discord)' };", "login-d")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
for dead in ["quickCards", "Generate Code", "Get Ideas", "Debug Code", "Build Something",
             "i-arrow", "YUX FF", "demo brain", "XR Core (demo)", "engine: demo",
             ".card{", ".quick{"]:
    if dead in clean:
        print("SANITY FAILED — leftover:", dead); sys.exit(1)
for keep in ["Prime AI", "Yug and Saksham", "homeForm", "netCheck", "/api/chat", "AI online — hosted brain"]:
    if keep not in clean:
        print("SANITY FAILED — missing:", keep); sys.exit(1)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — cards removed, Prime AI branding, Made by Yug and Saksham, bytes:", len(src.encode("utf-8")))
