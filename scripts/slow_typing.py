#!/usr/bin/env python3
"""XR CODE — slow down the AI reply typing animation (was 3 chars/14ms ≈ 214 chars/s → too fast).
New: 1 char per 16ms (~62 chars/s), extra-long replies (>900 chars) use 2 chars per tick so they don't drag forever."""
import re, shutil, subprocess, sys

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-slow.html'

src = open(SRC, encoding='utf-8').read()
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# 1) slower chunk: 1 char per tick (2 for very long replies so they don't take forever)
src = rep(src,
    "    i += 3;\n",
    "    i += (reply.text.length > 900 ? 2 : 1);   // slow, human-like typing\n")

# 2) slower tick: 14ms -> 16ms (~62 chars/s for normal replies)
src = rep(src,
    "  }, 14);\n}",
    "  }, 16);\n}",
    count=1)

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity (strip base64 payloads first to avoid false positives) ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('i += (reply.text.length > 900 ? 2 : 1)') == 1
assert core.count('}, 16);') == 1
assert 'i += 3' not in core
assert '}, 14);' not in core

# ---- JS syntax check on the extracted <script> ----
m = re.search(r'<script>(.*?)</script>', src, re.S)
assert m, 'no <script> block'
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)

print('OK — typing slowed: 1 char/16ms (~62 chars/s), long replies 2 chars/tick')
