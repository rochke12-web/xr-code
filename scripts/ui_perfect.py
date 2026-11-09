#!/usr/bin/env python3
"""XR-Code triple-platform UI perfection patch (iOS · Android · PC).
Idempotent: exits if XR-TRIPLATFORM marker already present."""
import re, sys, shutil

F = "/home/z/my-project/download/xr-code.html"
shutil.copy(F, "/home/z/my-project/scripts/xr-pre-triplatform.html")

src = open(F, encoding="utf-8").read()
if "XR-TRIPLATFORM" in src:
    print("already patched — exit")
    sys.exit(0)

# ---------- 1. viewport + PWA/platform metas ----------
old_vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0'
assert src.count(old_vp) == 1, f"viewport anchor x{src.count(old_vp)}"
new_vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover'
src = src.replace(old_vp, new_vp)

metas = (
  '<meta name="XR-TRIPLATFORM" content="1">\n'
  '<meta name="mobile-web-app-capable" content="yes">\n'
  '<meta name="apple-mobile-web-app-capable" content="yes">\n'
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  '<meta name="apple-mobile-web-app-title" content="XR Code">\n'
  '<meta name="theme-color" content="#000000">\n'
)
anchor = '<meta name="viewport"'
i = src.index(anchor)
src = src[:i] + metas + src[i:]

# ---------- 2. triple-platform CSS ----------
css = """
/* ===== XR-TRIPLATFORM · iOS notch · Android keyboard · PC focus ===== */
html,body{overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
body{min-height:100vh;min-height:100dvh}
@supports (padding:max(0px)){
  .topbar{padding-top:max(10px,env(safe-area-inset-top));padding-left:max(20px,env(safe-area-inset-left));padding-right:max(20px,env(safe-area-inset-right))}
  .composer{padding-bottom:max(18px,env(safe-area-inset-bottom));padding-left:max(24px,env(safe-area-inset-left));padding-right:max(24px,env(safe-area-inset-right))}
  .sidebar{padding-bottom:env(safe-area-inset-bottom)}
}
@media (pointer:coarse){
  .composer input,.big-search input,.chat-search input,.st-input{font-size:16px !important}
  .send-btn,.file-btn,.theme-quick{min-width:44px;min-height:44px}
  .nav button{padding:12px 11px}
  .sr-item{padding:11px 10px}
  .msgs,.chat-list,.search-list{-webkit-overflow-scrolling:touch}
}
body.kbd-open .composer{padding-bottom:10px}
@media (hover:hover) and (pointer:fine){
  a,button,input,textarea,[contenteditable]{outline:none}
  a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px;border-radius:10px}
}
@media (min-width:1600px){.hero{padding:56px 40px}}
"""
src = src.replace("</style>", css + "</style>", 1)

# ---------- 3. platform JS (visualViewport keyboard + iOS blur + theme-color sync) ----------
js = """<script>/* ===== XR-TRIPLATFORM runtime · iOS · Android · PC ===== */
(function(){
  var touch = window.matchMedia('(pointer:coarse)').matches;
  var vv = window.visualViewport;
  if (vv) {
    var base = Math.min(vv.height, window.innerHeight) || vv.height;
    var apply = function(){
      var open = touch && (vv.height < base - 90);
      document.body.classList.toggle('kbd-open', open);
      document.documentElement.style.setProperty('--vvh', vv.height + 'px');
      if (open) { var m = document.getElementById('msgs'); if (m) m.scrollTop = m.scrollHeight; }
    };
    vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply);
    setTimeout(apply, 400);
  }
  document.addEventListener('touchstart', function(e){
    if (!touch) return;
    var t = e.target;
    if (t.closest && (t.closest('input,textarea,[contenteditable]') || t.closest('button,a,label,.composer,.nav,.chat-list,.sr-item'))) return;
    var ae = document.activeElement;
    if (ae && ae !== document.body && ae.blur) ae.blur();
  }, {passive:true});
  var syncTheme = function(){
    var dark = document.documentElement.getAttribute('data-theme') !== 'light';
    var m = document.querySelector('meta[name="theme-color"]:not([media])');
    if (m) m.setAttribute('content', dark ? '#000000' : '#f4f6f8');
  };
  try { new MutationObserver(syncTheme).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']}); } catch(e){}
  syncTheme();
})();
</script>"""
# inject before the LAST </body> — the real document end (earlier ones live inside JS strings)
idx = src.rindex("</body>")
src = src[:idx] + js + "\n" + src[idx:]

# ---------- 4. brain-level resilience: retry ok:false engine hiccups ----------
old_fail = "      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n      break;                                           // server already retried upstream — surface it"
assert old_fail in src, "fail-branch anchor missing"
new_fail = ("      failed = new Error(d && d.error ? d.error : 'HTTP ' + res.status);\n"
            "      if(d && d.error && /engine/i.test(String(d.error)) && attempt < RETRY_WAITS.length){\n"
            "        chip.textContent = 'busy · retrying…';          // engine hiccup — silent self-heal\n"
            "        await new Promise(r => setTimeout(r, RETRY_WAITS[attempt]));\n"
            "        continue;\n"
            "      }\n"
            "      break;                                           // real error — surface it")
src = src.replace(old_fail, new_fail, 1)

open(F, "w", encoding="utf-8").write(src)

# ---------- verify: extract main JS and syntax-check ----------
m = re.search(r"<script>(.*?)</script>", src[src.index('SOURCE GUARD'):], re.S)
# node --check on the primary app script (largest script block)
blocks = re.findall(r"<script>(.*?)</script>", src, re.S)
big = max(blocks, key=len)
open("/tmp/xr_check.js", "w", encoding="utf-8").write(big)
import subprocess
r = subprocess.run(["node", "--check", "/tmp/xr_check.js"], capture_output=True, text=True)
print("JS syntax:", "OK" if r.returncode == 0 else r.stderr[:800])
print("viewport-fit:", "viewport-fit=cover" in src)
print("metas:", src.count("mobile-web-app-capable") >= 2)
print("css:", "safe-area-inset-top" in src and "100dvh" in src)
print("js:", "visualViewport" in src)
print("retry:", "/engine/i.test" in src)
