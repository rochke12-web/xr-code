#!/usr/bin/env python3
"""no_google_logo.py — XR CODE polish (idempotent):
- account linking is Discord-only: Google button, texts, handler and #i-g icon removed
- the "AI" badge inside the home search bar is replaced with the XR logo image
Edits download/xr-code.html in place; safe to re-run.
"""
import base64, io, os, re, shutil, subprocess, sys, tempfile

from PIL import Image

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-nogoogle.html"
SRC  = "/home/z/my-project/upload/XR-modified.png"

def b64_png(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

b96 = b64_png(Image.open(SRC).convert("RGBA").resize((96, 96), Image.LANCZOS))

src = open(F, encoding="utf-8").read()

if "Link Google" not in src and "bs-logo" in src:
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

# ============ 1. Discord-only account linking ============
rep('''    const st = document.createElement('div'); st.className = 'login-stack'; st.style.marginTop = '8px';
    const g = document.createElement('button'); g.className = 'auth-btn'; g.type = 'button';
    g.innerHTML = '<svg class="ic"><use href="#i-g"/></svg> Link Google <span class="sub">optional</span>';
    const d = document.createElement('button'); d.className = 'auth-btn'; d.type = 'button';
    d.innerHTML = '<svg class="ic"><use href="#i-discord"/></svg> Link Discord <span class="sub">optional</span>';
    g.onclick = () => login('google');
    d.onclick = () => login('discord');
    st.append(g, d);''',
    '''    const st = document.createElement('div'); st.className = 'login-stack'; st.style.marginTop = '8px';
    const d = document.createElement('button'); d.className = 'auth-btn'; d.type = 'button';
    d.innerHTML = '<svg class="ic"><use href="#i-discord"/></svg> Link Discord <span class="sub">optional</span>';
    d.onclick = () => login('discord');
    st.append(d);''', "auth-buttons")

rep('''  S.user = provider === 'google'
    ? { provider: 'google',   name: 'Yug and Saksham (Google)' }
    : { provider: 'discord',  name: 'Yug and Saksham (Discord)' };''',
    "  S.user = { provider: 'discord', name: 'Yug and Saksham (Discord)' };", "login-fn")

rep("  toast('Linked ' + provider.charAt(0).toUpperCase() + provider.slice(1) + ' — chats are marked as synced');",
    "  toast('Linked Discord — chats are marked as synced');", "login-toast")

rep("  return p === 'google' ? 'your Google account' : 'your Discord account';",
    "  return 'your Discord account';", "provider-label")

rep("Not linked. Connecting Google or Discord is optional — chats save in this browser either way.",
    "Not linked. Connecting Discord is optional — chats save in this browser either way.", "acc-copy")

rep("Chats save locally — linking Google or Discord (Settings) is optional.",
    "Chats save locally — linking Discord (Settings) is optional.", "sync-copy")

rep("toast('Linking Google or Discord (Settings) is optional — chats already save in this browser')",
    "toast('Linking Discord (Settings) is optional — chats already save in this browser')", "sync-toast")

rep("Chats are stored in this browser. Linking Google or Discord is optional",
    "Chats are stored in this browser. Linking Discord is optional", "settings-note")

rep("    user: null,              // optional Google/Discord link — only marks chats as synced",
    "    user: null,              // optional Discord link — only marks chats as synced", "state-cmt")

# Google icon symbol (multicolored G) — unused now
rep('''  <symbol id="i-g" viewBox="0 0 24 24">
    <path fill="#4285F4" stroke="none" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" stroke="none" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" stroke="none" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
    <path fill="#EA4335" stroke="none" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </symbol>
''', '', "i-g-def")

# ============ 2. search bar: XR logo instead of the AI badge ============
rep('<span class="ai">AI</span>',
    f'<img class="bs-logo" src="data:image/png;base64,{b96}" alt="XR logo" draggable="false">',
    "search-badge")

rep('''.big-search .ai{
  font-family:var(--font-mono);font-size:12px;color:var(--accent);
  border:1px solid var(--line);border-radius:8px;padding:3px 8px;white-space:nowrap;
}''',
    '.big-search .bs-logo{width:30px;height:30px;border-radius:9px;object-fit:cover;display:block;flex:none;box-shadow:0 0 0 1px var(--line)}',
    "search-badge-css")

if fails:
    print("ANCHOR FAILURES:")
    for f in fails: print(" -", f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

# ============ sanity (fonts.googleapis.com is allowed to stay) ============
clean = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src).replace("fonts.googleapis", "FONTS")
for dead in ["Google", "google", "Link Google", 'id="i-g"', 'href="#i-g"', 'class="ai"', ".big-search .ai"]:
    if dead in clean:
        print("SANITY FAILED — leftover:", dead); sys.exit(1)
for keep in ["Link Discord", "bs-logo", "i-discord", "login('discord')", "netCheck", "/api/chat"]:
    if keep not in clean:
        print("SANITY FAILED — missing:", keep); sys.exit(1)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

print("OK — Discord-only login, XR logo in search bar, bytes:", len(src.encode("utf-8")))
