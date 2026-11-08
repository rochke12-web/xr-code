#!/usr/bin/env python3
"""startup_modal.py — XR CODE startup model gate (idempotent):
On open (when no Z.ai key is connected) show a modal: "Select a model to start".
Step 1: one card — Z.ai (GLM-4.6) · main ai. Click to continue.
Step 2: button that opens https://z.ai/manage-apikey/apikey-list in a new tab
        + input to paste the API key + "start" button.
Skip link keeps the XR Core demo path. If a key is already connected, the modal never shows.
Edits download/xr-code.html in place; safe to re-run.
"""
import os, shutil, subprocess, sys, tempfile

F    = "/home/z/my-project/download/xr-code.html"
SNAP = "/home/z/my-project/scripts/xr-pre-startup.html"

src = open(F, encoding="utf-8").read()

if "startModal" in src:
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

# ============================================================
# 1. CSS — startup modal
# ============================================================
rep("@media (max-width:980px){",
    '''/* ---------- startup — select a model ---------- */
.startup-back{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:none;align-items:center;justify-content:center;padding:22px}
.startup-back.open{display:flex}
.startup{width:min(430px,94vw);max-height:88vh;overflow:auto;background:var(--panel-2);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:30px 26px 22px;text-align:center;animation:stIn .25s ease}
@keyframes stIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
.st-brand{font-family:var(--font-head);letter-spacing:.34em;font-size:13px;color:var(--muted);margin-bottom:14px}
.startup h2{font-family:var(--font-head);font-size:22px;letter-spacing:.06em;margin:0 0 8px}
.st-sub{font-size:12.5px;color:var(--muted);line-height:1.65;margin:0 0 20px}
.st-card{width:100%;display:flex;align-items:center;gap:12px;padding:18px;border-radius:16px;border:1px solid var(--line);background:var(--panel);cursor:pointer;font-family:var(--font-body);transition:border-color .15s,transform .15s}
.st-card:hover{border-color:var(--accent-2);transform:translateY(-1px)}
.st-name{font-size:16px;font-weight:700;color:var(--text);flex:1;text-align:left}
.st-name em{display:block;font-style:normal;font-weight:500;font-size:11.5px;color:var(--muted);margin-top:3px;letter-spacing:.04em}
.st-tag{padding:3px 9px;border-radius:99px;font-size:9.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;background:var(--accent);color:var(--accent-ink)}
.st-go{font-size:13px;font-weight:700;color:var(--accent-2)}
.st-open{display:block;width:100%;box-sizing:border-box;text-align:left;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:var(--panel);color:var(--text);text-decoration:none;margin-bottom:12px}
.st-open:hover{border-color:var(--accent-2)}
.st-open b{display:block;font-size:13.5px;margin-bottom:3px}
.st-open span{font-size:11.5px;color:var(--muted);line-height:1.55}
.st-input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font:500 13px var(--font-mono);margin-bottom:12px}
.st-input:focus{outline:1px solid var(--accent-2)}
.st-go-btn{width:100%;padding:13px;border-radius:12px;border:0;background:var(--accent);color:var(--accent-ink);font:700 13.5px var(--font-body);cursor:pointer}
.st-go-btn:hover{filter:brightness(1.08)}
.st-skip{display:block;margin:14px auto 0;background:none;border:0;color:var(--muted);font:500 11.5px var(--font-body);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.st-skip:hover{color:var(--text)}
@media (max-width:980px){''',
    "startup-css")

# ============================================================
# 2. HTML — modal markup before toasts
# ============================================================
rep('<div class="toasts" id="toasts"></div>',
    '''<!-- ============ STARTUP — SELECT A MODEL ============ -->
<div class="startup-back" id="startModal">
  <div class="startup" role="dialog" aria-modal="true" aria-label="Select a model to start">
    <div class="st-brand">XR CODE</div>
    <h2>Select a model to start</h2>
    <p class="st-sub">XR CODE runs on Z.ai. Connect your API key once &mdash; it stays in this browser only.</p>
    <div id="stBody"></div>
  </div>
</div>

<div class="toasts" id="toasts"></div>''',
    "startup-html")

# ============================================================
# 3. JS — startup flow functions
# ============================================================
rep('''function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}''',
    '''function providerLabel(p){
  return p === 'google' ? 'your Google account' : 'your Discord account';
}

/* ---------- startup — select a model to start ---------- */
const ZAI_KEY_PAGE = 'https://z.ai/manage-apikey/apikey-list';
function openStartup(){ stStep1(); $('#startModal').classList.add('open'); }
function closeStartup(){ $('#startModal').classList.remove('open'); }
function stStep1(){                                   // step 1 — pick the model (Z.ai only)
  const b = $('#stBody'); b.innerHTML = '';
  const card = document.createElement('button'); card.className = 'st-card'; card.type = 'button';
  card.innerHTML = '<span class="st-name">Z.ai <em>GLM-4.6 &mdash; runs the whole app</em></span>' +
                   '<span class="st-tag">main ai</span><span class="st-go">Start &rarr;</span>';
  card.onclick = stStep2;
  const skip = document.createElement('button'); skip.className = 'st-skip'; skip.type = 'button';
  skip.textContent = 'Skip for now — try the XR Core demo';
  skip.onclick = () => { closeStartup(); toast('Demo mode — connect Z.ai anytime in AI Models'); };
  b.append(card, skip);
}
function stStep2(){                                   // step 2 — key page redirect + enter key
  const b = $('#stBody'); b.innerHTML = '';
  const o = document.createElement('a'); o.className = 'st-open'; o.target = '_blank'; o.rel = 'noopener';
  o.href = ZAI_KEY_PAGE;
  o.innerHTML = '<b>1 &middot; Get your API key</b><span>Opens z.ai &mdash; API Keys &rarr; create a new key and copy it</span>';
  const inp = document.createElement('input'); inp.className = 'st-input'; inp.type = 'password';
  inp.id = 'stKey'; inp.autocomplete = 'off';
  inp.placeholder = 'sk-... — paste your Z.ai API key here';
  const go = document.createElement('button'); go.className = 'st-go-btn'; go.type = 'button';
  go.textContent = '2 · Enter key & start XR CODE';
  const start = () => {
    const k = inp.value.trim();
    if(!k){ toast('Paste the Z.ai API key first — step 1 opens the z.ai key page'); inp.focus(); return; }
    S.zai = { model: 'glm-4.6' };
    S.zaiKey = k;                                     // stays in this browser only
    save();
    const btn = $('#zaiToggle'); btn.textContent = 'Connected'; btn.classList.add('ok');
    renderModels(); renderChat(); renderStatus(); renderZaiLine(); updateSyncUI();
    closeStartup();
    toast('Z.ai connected — GLM-4.6 now runs every answer');
  };
  go.onclick = start;
  inp.addEventListener('keydown', e => { if(e.key === 'Enter') start(); });
  const back = document.createElement('button'); back.className = 'st-skip'; back.type = 'button';
  back.textContent = 'Back';
  back.onclick = stStep1;
  b.append(o, inp, go, back);
  setTimeout(() => inp.focus(), 60);
}''',
    "startup-js")

# ============================================================
# 4. INIT — show the gate on open until a key is connected
# ============================================================
rep('''if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
renderZaiLine();''',
    '''if(S.zai){ const b = $('#zaiToggle'); b.textContent = 'Connected'; b.classList.add('ok'); }
renderZaiLine();
if(!zaiReady()) openStartup();''',
    "startup-init")

# ============================================================
# report + JS syntax check
# ============================================================
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
    print("JS SYNTAX ERROR:\\n" + r.stderr[:2000]); sys.exit(1)

for good in ["startModal", "stStep1", "stStep2", "openStartup", "closeStartup",
             "z.ai/manage-apikey/apikey-list", "Select a model to start", "st-go-btn"]:
    if good not in src:
        print("MISSING: " + good); sys.exit(1)

print("OK — startup modal applied:", len(src), "bytes")
