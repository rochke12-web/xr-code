import re, subprocess, tempfile, os
html = open('download/xr-code.html', encoding='utf-8').read()
scripts = re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', html, re.S | re.I)
print('inline script blocks:', len(scripts))
bad = 0
for i, s in enumerate(scripts):
    if not s.strip():
        continue
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
        f.write(s); tmp = f.name
    r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
    if r.returncode != 0:
        bad += 1
        print(f'BLOCK {i}: SYNTAX ERROR')
        print(r.stderr[:300])
    os.unlink(tmp)
print('syntax errors:', bad)
# quick HTML sanity: balanced key tags
for tag in ['div', 'button', 'svg', 'section', 'iframe']:
    o = len(re.findall(rf'<{tag}[\s>]', html)); c = len(re.findall(rf'</{tag}>', html))
    print(f'<{tag}>: open={o} close={c} {"OK" if o == c else "MISMATCH"}')
