"""Inject the ai-video-editor style engines into xr-code.html.

Reads the Nafay 3D style base.js files from assets/mograph/ and embeds them
base64-encoded in a plain <script id="xr-mg"> block (the main app script
stays FIRST so build_private.py's obfuscator picks the right one). The client
decodes with atob at render time — the styles never ride the network.

Idempotent: an existing block is replaced, not duplicated.
"""
import base64, json, re, os

ROOT = "/home/z/my-project"
SRC = f"{ROOT}/download/xr-code.html"
STYLES_DIR = f"{ROOT}/assets/mograph"
STYLES = ["creator-motion-graphics", "clean-tech", "data-story"]

fonts = {
    "creator-motion-graphics": "Anton|Instrument+Serif:ital@0;1|Inter:wght@400;500;600;700;800",
    "clean-tech": "Inter+Tight:wght@400;500;600;700;800|JetBrains+Mono:wght@400;600|Inter:wght@400;500;600;700",
    "data-story": "Archivo:wght@400;500;600;700;800|IBM+Plex+Mono:wght@400;500;600",
}

payload = {}
for s in STYLES:
    p = os.path.join(STYLES_DIR, f"{s}.base.js")
    payload[s] = {
        "b64": base64.b64encode(open(p, "rb").read()).decode(),
        "fonts": fonts[s],
    }

block = ('<script id="xr-mg">window.XR_MG_B64=' + json.dumps(payload, separators=(",", ":")) + ";"
         "</script>\n</body>")

html = open(SRC).read()
if 'id="xr-mg"' in html:
    html = re.sub(r'<script id="xr-mg">.*?</script>\n</body>', lambda _: "", html, count=1, flags=re.S)
# insert before the REAL closing body tag — the app's srcdoc builder strings
# contain literal '</body>' earlier in the file, so use the LAST occurrence
i = html.rfind("</body>")
assert i > 0, "no closing body tag found"
html = html[:i] + block[: -len("</body>")] + html[i:]
open(SRC, "w").write(html)
print("injected styles:", ", ".join(f"{s} ({len(payload[s]['b64'])//1024}KB b64)" for s in STYLES))
