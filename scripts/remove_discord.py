#!/usr/bin/env python3
"""Remove every remaining Discord trace from XR-Code (login = Google only).
HTML app: dead ds-* CSS, i-discord icon, stub renames, stale comments.
Gate component: Discord invite link + its CSS + fine-print sentence.
Every replacement is asserted; a missed pattern fails the script loudly.
"""
import re, sys

HTML = "/home/z/my-project/download/xr-code.html"
GATE = "/home/z/my-project/src/components/google-signin-gate.tsx"

def apply(path, subs, regex_subs=()):
    s = open(path, encoding="utf-8").read()
    for old, new in subs:
        n = s.count(old)
        assert n >= 1, f"MISS in {path}: {old[:90]!r} (count {n})"
        s = s.replace(old, new)
        print(f"ok  x{n}: {old[:70]!r}")
    for pat, new in regex_subs:
        s2, n = re.subn(pat, new, s, flags=re.S)
        assert n >= 1, f"MISS regex in {path}: {pat[:80]!r}"
        s = s2
        print(f"ok regex x{n}: {pat[:70]!r}")
    open(path, "w", encoding="utf-8").write(s)
    print(f"--- wrote {path} ---")

DS_PIN_CSS = """/* owner role-link card (Settings \u2192 accounts, verified guild owner, role unpinned) */
.ds-pin{
  display:flex;flex-direction:column;gap:8px;border:1px dashed var(--line);border-radius:12px;
  padding:12px 15px;margin-top:8px;background:var(--bg2);animation:fadeUp .4s var(--ease) both;
}
.ds-pin-l{font-size:11px;color:var(--muted);line-height:1.5}
.ds-pin-r{display:flex;gap:8px}
.ds-pin-r input{
  flex:1;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;
  padding:8px 12px;font:500 12.5px var(--font-mono);color:var(--text);letter-spacing:.04em;
  transition:border-color .2s,background .2s;
}
.ds-pin-r input:focus{outline:none;border-color:var(--accent-2);background:var(--panel-2)}
.ds-pin-r input::placeholder{color:var(--faint);letter-spacing:0}
.ds-pin-b{
  border:1px solid var(--accent);background:var(--accent);color:var(--accent-ink);
  border-radius:10px;padding:8px 16px;font:600 12px var(--font-body);cursor:pointer;
  transition:transform .25s var(--spring),opacity .2s;
}
.ds-pin-b:hover{transform:translateY(-1px)}
.ds-pin-b:active{transform:scale(.95)}
.ds-pin-b:disabled{opacity:.5;cursor:wait}
.ds-pin-m{font-size:10.5px;color:var(--muted);line-height:1.5}
.ds-pin-m:empty{display:none}
"""

DS_GATE_CSS = """/* ============================================================
   DISCORD GATE \u2014 members only
   ============================================================ */
.ds-lock{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.82);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.ds-lock[hidden]{display:none}
:root[data-theme="light"] .ds-lock{background:rgba(248,248,248,.86)}
.ds-card{
  width:min(430px,92vw);background:var(--panel-2);border:1px solid var(--line);border-radius:24px;padding:36px 32px;text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.55);
  position:relative;animation:stIn .5s var(--spring) backwards;
}
.ds-card::before{
  content:"";position:absolute;inset:-2px;border-radius:26px;padding:2px;z-index:0;
  background:conic-gradient(from var(--gp),
    rgba(255,255,255,0) 0turn .62turn,
    var(--accent-2) .8turn, var(--text) .92turn, var(--accent-2) .97turn,
    rgba(255,255,255,0) 1turn);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  animation:gp-spin 6s linear infinite;
  pointer-events:none;
}
.ds-card > *{position:relative;z-index:1}
.ds-logo{height:58px;width:58px;margin:0 auto 16px;border-radius:16px;overflow:hidden;animation:ds-breathe 5s ease-in-out infinite}
.ds-logo .logo-img{width:100%;height:100%;object-fit:cover;display:block}
@keyframes ds-breathe{
  0%,100%{filter:drop-shadow(0 0 8px var(--accent-2)) grayscale(1);transform:scale(1)}
  50%{filter:drop-shadow(0 0 22px var(--text)) grayscale(1);transform:scale(1.04)}
}
.ds-card h2{margin:0 0 8px;font-size:20px;letter-spacing:.01em;color:var(--text);font-family:var(--font-head);font-weight:700}
.ds-sub{margin:0 0 18px;font-size:12.5px;line-height:1.7;color:var(--muted)}
.ds-err{margin:0 0 14px;padding:10px 13px;border-radius:11px;border:1px dashed var(--line);background:var(--panel);color:var(--text);font-size:12px;line-height:1.55;animation:err-shake .5s var(--ease) backwards}
@keyframes err-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.ds-btn{
  display:inline-flex;align-items:center;gap:9px;background:var(--accent);color:var(--accent-ink);border:none;border-radius:13px;padding:13px 24px;font-size:13.5px;font-weight:600;letter-spacing:.02em;cursor:pointer;font-family:inherit;
  transition:transform .3s var(--spring),filter .2s,box-shadow .3s;
  position:relative;overflow:hidden;
  animation:ds-pulse 3.6s ease-in-out infinite;
}
.ds-btn:hover{filter:brightness(1.08);transform:translateY(-2px);box-shadow:0 10px 32px -8px var(--glow)}
.ds-btn:active{transform:translateY(0) scale(.97)}
.ds-btn .ic{width:18px;height:18px}
@keyframes ds-pulse{
  0%,100%{box-shadow:0 6px 26px -8px rgba(127,127,127,.5)}
  50%{box-shadow:0 8px 40px -6px var(--glow)}
}
.ds-steps{display:flex;align-items:center;justify-content:center;gap:6px;margin:0 0 18px;flex-wrap:wrap}
.ds-step{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted);letter-spacing:.02em;background:var(--panel);border:1px solid var(--line-soft);border-radius:999px;padding:5px 11px;white-space:nowrap;transition:border-color .2s,color .2s}
.ds-step:hover{border-color:var(--accent-2);color:var(--text)}
.ds-step b:first-child{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-size:9px}
.ds-step:hover b:first-child{animation:xr-tabpop .4s var(--spring)}
.ds-arrow{color:var(--muted);font-size:11px;opacity:.7}
.ds-invite{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-size:12.5px;font-weight:600;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:12px 22px;text-decoration:none;transition:transform .3s var(--spring),border-color .2s,color .2s,box-shadow .3s}
.ds-invite .ic{width:17px;height:17px}
.ds-invite:hover{border-color:var(--accent-2);transform:translateY(-2px);box-shadow:0 8px 24px -8px var(--glow)}
.ds-invite:active{transform:translateY(0) scale(.98)}
.ds-fine{margin:18px 0 0;font-size:10.5px;color:var(--muted);letter-spacing:.04em;line-height:1.6}

"""

STUBS_OLD = """window.dsShowLock = function(){ window.parent.location.reload(); };
window.dsAccRow = function(){ const row = document.createElement('div'); row.textContent = 'Signed in with Google'; return row; };"""
STUBS_NEW = """window.xrSessionExpired = function(){ window.parent.location.reload(); };
window.xrAccRow = function(){ const row = document.createElement('div'); row.textContent = 'Signed in with Google'; return row; };"""

PIN_GUARD_OLD = """  /* don't wipe a half-typed Role ID: netCheck re-renders accounts every 20s,
   * and that must never erase the owner's in-progress role-link input */
  const pinInput = box.querySelector('.ds-pin input');
  if(pinInput && (document.activeElement === pinInput || pinInput.value.trim() !== '')) return;
  box.innerHTML = '';"""
PIN_GUARD_NEW = """  box.innerHTML = '';"""

CLOUD_CMT_OLD = "/* The server keeps each verified member's chats keyed by their Discord id"
CLOUD_CMT_NEW = "/* The server keeps each verified member's chats keyed by their Google account id"

GATE_INVITE_CSS = (".ds-invite{display:inline-flex;align-items:center;gap:8px;margin-top:14px;"
  "font-size:12.5px;font-weight:600;color:var(--text);background:var(--panel);border:1px solid var(--line);"
  "border-radius:13px;padding:12px 22px;text-decoration:none;transition:transform .3s var(--spring),"
  "border-color .2s,color .2s,box-shadow .3s}\\n.ds-invite .ic{width:17px;height:17px}\\n"
  ".ds-invite:hover{border-color:var(--accent-2);transform:translateY(-2px);box-shadow:0 8px 24px -8px var(--glow)}\\n"
  ".ds-invite:active{transform:translateY(0) scale(.98)}\\n")

apply(HTML, [
    (DS_PIN_CSS, ""),
    (DS_GATE_CSS, ""),
    (STUBS_OLD, STUBS_NEW),
    (PIN_GUARD_OLD, PIN_GUARD_NEW),
    (CLOUD_CMT_OLD, CLOUD_CMT_NEW),
    ("window.dsShowLock(d.auth); return;", "window.xrSessionExpired(); return;"),
    ("if(window.dsAccRow) box.append(window.dsAccRow());", "if(window.xrAccRow) box.append(window.xrAccRow());"),
], regex_subs=[
    (r'<symbol id="i-discord".*?</symbol>', ""),
])

apply(GATE, [
    (GATE_INVITE_CSS, ""),
    ("Sign in securely with Google \u2014 this app never sees your password. Joining the XR server is optional.",
     "Sign in securely with Google \u2014 this app never sees your password."),
], regex_subs=[
    (r'<br />\s*<a className="ds-invite".*?</a>\n', ""),
])

# final proof: no discord traces left in either file (the gate keeps ds-btn/ds-card etc.
# \u2014 those class names are the Google sign-in screen styling itself)
for path in (HTML, GATE):
    s = open(path, encoding="utf-8").read().lower()
    for bad in ("discord", "dsshowlock", "dsaccrow", "ds-pin", "ds-invite", "pinrole", "xr-auth"):
        assert bad not in s, f"LEFTOVER in {path}: {bad}"
print("PROOF: no discord/dsShowLock/dsAccRow/ds-pin/ds-invite/pinrole/XR-Auth traces remain")
