"""Build the PRIVATE (encrypted + obfuscated) payload of XR-Code:
1. extract <script> -> javascript-obfuscator (control-flow + string array)
2. minify CSS (clean-css) + strip comments/blank lines from markup
3. reassemble -> XOR-encrypt with rolling key -> base64 -> src/app/payload.ts
   (view-source exposes only encrypted base64; the loader decrypts at runtime)
"""
import base64, os, re, subprocess

ROOT = '/home/z/my-project'
SRC  = f'{ROOT}/download/xr-code.html'
TMP  = '/tmp/xrbuild'
KEY  = b'XrC0de~Guard!v1'
os.makedirs(TMP, exist_ok=True)

html = open(SRC).read()

# ---- 1. extract the app script ----
m = re.search(r'<script>(.*?)</script>', html, re.S)
assert m, 'script tag not found'
open(f'{TMP}/app.js', 'w').write(m.group(1))

# ---- 2. obfuscate JS ----
r = subprocess.run([
    'node_modules/.bin/javascript-obfuscator', f'{TMP}/app.js',
    '--output', f'{TMP}/app.obf.js',
    '--compact', 'true',
    '--control-flow-flattening', 'true',
    '--control-flow-flattening-threshold', '0.6',
    '--string-array', 'true',
    '--string-array-encoding', 'base64',
    '--string-array-threshold', '0.8',
    '--transform-object-keys', 'true',
    '--self-defending', 'true',        # resists de-obfuscation / beautify
    '--debug-protection', 'true',      # fights devtools inspection of the payload
    '--unicode-escape-sequence', 'false',
], capture_output=True, text=True)
assert r.returncode == 0, r.stderr
obf = open(f'{TMP}/app.obf.js').read()
print('JS obfuscated:', len(m.group(1)) // 1024, 'KB ->', len(obf) // 1024, 'KB')

# ---- 3. minify CSS ----
css = re.search(r'<style>(.*?)</style>', html, re.S).group(1)
open(f'{TMP}/app.css', 'w').write(css)
r = subprocess.run(['node_modules/.bin/cleancss', '-O2', f'{TMP}/app.css'],
                   capture_output=True, text=True)
assert r.returncode == 0, r.stderr
css_min = r.stdout.strip()
print('CSS minified:', len(css) // 1024, 'KB ->', len(css_min) // 1024, 'KB')

# ---- 4. reassemble: strip comments, collapse blank lines, swap css/js ----
out = re.sub(r'<style>.*?</style>', '<style>' + css_min.replace('\\', '\\\\') + '</style>', html, flags=re.S)
# ONLY the first (main app) script block gets the obfuscated JS — auxiliary blocks
# (e.g. the triplatform runtime) must stay as they are, never get a second app copy
out = re.sub(r'<script>.*?</script>', '<script>' + obf.replace('\\', '\\\\') + '</script>', out, count=1, flags=re.S)
out = re.sub(r'<!--.*?-->', '', out, flags=re.S)          # strip html comments
out = re.sub(r'\n\s*\n+', '\n', out)                      # collapse blank lines
out = out.replace('   Made by YUX FF  |  v1.0.0\n', '')   # header comment remnant

# sanity: app must still contain the key markers
for marker in ('XR-Code', 'big-search', 'data:image'):
    assert marker in out, 'missing marker ' + marker
# exactly two script blocks: obfuscated app + triplatform runtime — never a double app
assert out.count('<script>') == 2, f"script block count = {out.count('<script>')} (double-app guard)"

b64 = base64.b64encode(
    bytes(c ^ KEY[i % len(KEY)] for i, c in enumerate(out.encode('utf-8')))
).decode('ascii')
open(f'{ROOT}/src/app/payload.ts', 'w').write(
    '// XR-Code - private build (encrypted + obfuscated). Do not edit by hand.\n'
    'export const APP_B64 = "' + b64 + '";\n')
open(f'{ROOT}/download/xr-code-private.html', 'w').write(out)
print('private HTML:', len(out) // 1024, 'KB  |  payload.ts:', len(b64) // 1024, 'KB base64')
