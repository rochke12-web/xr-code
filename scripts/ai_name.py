#!/usr/bin/env python3
"""Name the AI "XR Code" (app brand stays XR-Space). Idempotent, count-checked.
AI name: chat who-labels, empty state, engine chips, chat placeholder, fallback text.
"""
import re, pathlib, shutil

P = pathlib.Path('/home/z/my-project/download/xr-code.html')
src = P.read_text(encoding='utf-8')
snap = pathlib.Path('/home/z/my-project/scripts/xr-pre-ainame.html')
if not snap.exists():
    shutil.copyfile(P, snap)

def rep(s, old, new, n):
    assert s.count(old) == n, f'anchor x{s.count(old)} (want {n}): {old[:70]!r}'
    return s.replace(old, new)

out = src
# engine chips mention the AI
out = rep(out, "'XR-Space AI'", "'XR Code AI'", 2)
out = rep(out, "'engine: XR-Space AI'", "'engine: XR Code AI'", 1)
out = rep(out, "'XR-Space AI (live)' : 'XR-Space AI (offline)'",
              "'XR Code AI (live)' : 'XR Code AI (offline)'", 1)
# who-labels on assistant bubbles (4 creation spots incl. ternary)
out = rep(out, "who.textContent = 'XR-Space';", "who.textContent = 'XR Code';", 2)
out = rep(out, "who0.textContent = 'XR-Space';", "who0.textContent = 'XR Code';", 1)
out = rep(out, "who.textContent = m.r === 'u' ? 'You' : 'XR-Space';",
              "who.textContent = m.r === 'u' ? 'You' : 'XR Code';", 1)
# empty chat state headline = the AI's name
out = rep(out, "'<span class=\"big\">XR-Space</span>Ask anything",
              "'<span class=\"big\">XR Code</span>Ask anything", 1)
# chat composer placeholder addresses the AI
out = rep(out, "placeholder=\"Message XR-Space...\"", "placeholder=\"Message XR Code...\"", 1)
out = rep(out, "inp.placeholder = 'Message XR-Space...';", "inp.placeholder = 'Message XR Code...';", 1)
# local-preview fallback copy
out = rep(out, '"Local preview — XR-Space answers for real when it runs on its hosted site."',
              '"Local preview — XR Code answers for real when it runs on its hosted site."', 1)

# sanity: exactly the 14 app-brand spots must remain XR-Space
left = out.count('XR-Space')
assert left == 14, f'app-brand spots: {left} (want 14)'
assert out.count('XR Code AI') == 5
assert len(re.findall(r"who0?\.textContent = (?:m\.r === 'u' \? 'You' : )?'XR Code';", out)) == 4

m = re.search(r'<script>(.*)</script>', out, re.S)
assert m, 'app script not found'
pathlib.Path('/tmp/_ainame_check.js').write_text(m.group(1), encoding='utf-8')

P.write_text(out, encoding='utf-8')
print('AI named: XR Code | app brand XR-Space intact (14 spots)')
