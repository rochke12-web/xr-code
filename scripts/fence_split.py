#!/usr/bin/env python3
"""XR CODE — split fenced code blocks out of live AI replies so the
code bar (file name + save button) renders for hosted answers too."""
import re, shutil, subprocess

SRC = '/home/z/my-project/download/xr-code.html'
BAK = '/home/z/my-project/scripts/xr-pre-fence.html'

src = open(SRC, encoding='utf-8').read()
if 'splitFence' in src:
    print('already applied — nothing to do')
    raise SystemExit(0)
shutil.copyfile(SRC, BAK)

def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, f'anchor x{n} (want x{count}): {old[:70]!r}'
    return s.replace(old, new)

# ---- 1. the splitter (next to the other code helpers) ----
src = rep(src,
"""function codeBlock(code){""",
"""function splitFence(t){                           // '```py\\ncode```' -> { text, code }
  const m = t.match(/```[\\w+-]*\\r?\\n([\\s\\S]*?)```/);
  if(!m) return { text: t };
  return { text: (t.slice(0, m.index) + t.slice(m.index + m[0].length)).trim(), code: m[1].replace(/\\s+$/, '') };
}
function codeBlock(code){""")

# ---- 2. live replies go through the splitter ----
src = rep(src,
"""    const t = (d.text || '').trim();
    if(!t) throw new Error('empty reply');
    chip.textContent = 'engine: live · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    NET.live = true; renderStatus();
    typeReply(c, { text: t }, true, pen);""",
"""    const t = (d.text || '').trim();
    if(!t) throw new Error('empty reply');
    chip.textContent = 'engine: live · ' + (window.modeLabel ? window.modeLabel() : 'Coder Mode');
    NET.live = true; renderStatus();
    typeReply(c, splitFence(t), true, pen);""")

open(SRC, 'w', encoding='utf-8').write(src)

# ---- sanity + JS check ----
core = re.sub(r'data:[a-zA-Z/+.-]+;base64,[A-Za-z0-9+/=]+', 'DATA', src)
assert core.count('splitFence') == 2, core.count('splitFence')
assert "typeReply(c, { text: t }, true, pen)" not in core
m = re.search(r'<script>(.*?)</script>', src, re.S)
open('/tmp/xr-check.js', 'w', encoding='utf-8').write(m.group(1))
subprocess.run(['node', '--check', '/tmp/xr-check.js'], check=True)
print('OK — live replies now split fenced code into the file bar')
