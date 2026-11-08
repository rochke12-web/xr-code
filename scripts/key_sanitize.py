#!/usr/bin/env python3
"""key_sanitize.py — fix 'String contains non ISO-8859-1 code point' fetch crash (idempotent):
The Authorization header must be plain ASCII. Keys pasted from chats/PDFs can carry
zero-width chars, NBSP, BOM, curly quotes or CJK glyphs — fetch rejects the request.
- zaiKeyClean(): strips spaces + every non-visible-ASCII char
- zaiKeyValid(): rejects obvious non-key junk
- applied at: startup modal, sidebar connect, and again at fetch time (old dirty keys)
- targeted error hint if the fetch crash ever still occurs
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-keysan.html"

src = open(F, encoding="utf-8").read()

if "zaiKeyClean" in src:
    print("already patched — nothing to do")
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

# 1. helpers after providerLabel
rep('''function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}''',
    '''function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}

/* ---------- key sanitizing (Authorization headers must be plain ASCII) ---------- */
function zaiKeyClean(raw){
  return String(raw || '')
    .replace(/\\s+/g, '')            // spaces, tabs, NBSP…
    .replace(/[^\\x21-\\x7E]/g, ''); // zero-width chars, BOM, curly quotes, CJK…
}
function zaiKeyValid(k){
  return /^[A-Za-z0-9._:~\\/+=-]{10,}$/.test(k);
}''',
    "helpers")

# 2. sidebar connectEngine — clean + validate
rep('''  const key = $('#zaiKey').value.trim();
  if(!key){ toast('Paste your Z.ai API key first'); return; }''',
    '''  const raw = $('#zaiKey').value.trim();
  const key = zaiKeyClean(raw);
  if(!key){ toast('Paste your Z.ai API key first'); return; }
  if(!zaiKeyValid(key)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); return; }
  if(raw !== key) toast('Hidden characters removed from the key');''',
    "connect-clean")

# 3. startup modal — clean + validate
rep('''    const k = inp.value.trim();
    if(!k){ toast('Paste the Z.ai API key first — step 1 opens the z.ai key page'); inp.focus(); return; }''',
    '''    const raw = inp.value.trim();
    const k = zaiKeyClean(raw);
    if(!k){ toast('Paste the Z.ai API key first — step 1 opens the z.ai key page'); inp.focus(); return; }
    if(!zaiKeyValid(k)){ toast('That does not look like a Z.ai API key — copy just the key from the z.ai key page (no quotes or spaces)'); inp.focus(); return; }
    if(raw !== k) toast('Hidden characters removed from the key');''',
    "startup-clean")

# 4. fetch time — always send a cleaned key (covers old dirty stored keys)
rep("        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.zaiKey },",
    "        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + zaiKeyClean(S.zaiKey) },",
    "fetch-clean")

# 5. targeted hint for that specific fetch crash (safety net)
rep('''      else
        hint = 'Z.ai is unreachable right now — check your connection and try again.';''',
    '''      else if(/ISO-8859-1|headers' property/i.test(err.message))
        hint = 'The stored key contains unsupported characters — click Connect key in AI Models and paste it again.';
      else
        hint = 'Z.ai is unreachable right now — check your connection and try again.';''',
    "hint-iso")

if fails:
    print("FAILED ANCHORS:")
    for f in fails: print("  " + f)
    sys.exit(1)

open(F, "w", encoding="utf-8").write(src)

js = src[src.rindex("<script>") + 8 : src.rindex("</script>")]
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf:
    tf.write(js); tmp = tf.name
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
os.unlink(tmp)
if r.returncode != 0:
    print("JS SYNTAX ERROR:\n" + r.stderr[:2000]); sys.exit(1)

for good in ["zaiKeyClean", "zaiKeyValid", "Hidden characters removed",
             "unsupported characters", "zaiKeyClean(S.zaiKey)"]:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

print("OK — key sanitizing applied:", len(src), "bytes")
