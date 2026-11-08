#!/usr/bin/env python3
"""XR CODE — remove all visible 'Prime AI' branding.
The offline/demo engine is now just 'XR CODE AI' (chips) / 'AI offline' (status bar)."""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-noprime.html'

src = open(SRC, encoding='utf-8').read()
if 'Prime AI' not in src:
    print('already removed — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# 1. chat message chip (old demo messages)
src = rep(src,
"""    chip.textContent = 'engine: ' + (m.m === 'XR Core' || m.m === 'demo' ? 'Prime AI' : 'live');""",
"""    chip.textContent = 'engine: ' + (m.m === 'XR Core' || m.m === 'demo' ? 'XR CODE AI' : 'live');""")

# 2. comment above canned replies
src = rep(src,
"""/* ---------- canned replies (Prime AI fallback) ---------- */""",
"""/* ---------- canned replies (offline fallback) ---------- */""")

# 3. typing-reply chip
src = rep(src,
"""  chip.textContent = 'engine: ' + (live ? 'live' : 'Prime AI');""",
"""  chip.textContent = 'engine: ' + (live ? 'live' : 'XR CODE AI');""")

# 4. askBrain error path chip
src = rep(src,
"""    chip.textContent = 'engine: Prime AI';""",
"""    chip.textContent = 'engine: XR CODE AI';""")

# 5. comment on the local-preview branch
src = rep(src,
"""          // local file preview — built-in Prime AI""",
"""          // local file preview — built-in fallback replies""")

# 6. settings account row
src = rep(src,
"""      ' · engine: ' + (NET.live ? 'XR CODE AI (live)' : 'Prime AI');""",
"""      ' · engine: ' + (NET.live ? 'XR CODE AI (live)' : 'XR CODE AI (offline)');""")

# 7. status bar text
src = rep(src,
"""  const txt = !NET.checked ? 'AI brain connecting…'
            : NET.live     ? 'AI online — hosted brain'
                           : 'Prime AI';""",
"""  const txt = !NET.checked ? 'AI brain connecting…'
            : NET.live     ? 'AI online — hosted brain'
                           : 'AI offline';""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
assert src.count('Prime AI') == 0, 'Prime AI still present'
assert src.count('XR CODE AI') >= 5
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — Prime AI branding fully removed')
