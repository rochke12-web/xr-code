#!/usr/bin/env python3
# strip every trace of the Discord gate from download/xr-code.html
import re, sys

P = 'download/xr-code.html'
src = open(P, encoding='utf-8').read()
lines = src.splitlines()
out = []
i = 0
n = len(lines)

def skip_to(pred, start, inclusive_end=True):
    """return index where pred(line) is True (searching from start)"""
    for k in range(start, n):
        if pred(lines[k]):
            return k
    return -1

while i < n:
    L = lines[i]
    S = L.strip()

    # 1) CSS block: /* discord gate */ ... up to and incl. .gate-alt:hover + blank line
    if S.startswith('/* ---------- discord gate (verified members only)'):
        while i < n and '.gate-alt:hover{color:var(--accent)}' not in lines[i]:
            i += 1
        i += 1                      # drop the .gate-alt line
        if i < n and lines[i].strip() == '':
            i += 1                  # drop trailing blank
        continue

    # 2) HTML overlay: <!-- discord gate --> ... until <div class="shell">
    if 'discord gate' in L and '<!--' in L:
        i += 1
        while i < n and '<div class="shell">' not in lines[i]:
            i += 1
        continue                    # keep <div class="shell"> (do not consume)

    # 3) JS block: /* discord gate (join + verify...) */ ... until /* ---------- init ---------- */
    if S.startswith('/* ---------- discord gate (join + verify'):
        i += 1
        while i < n and '/* ---------- init ----------' not in lines[i]:
            i += 1
        # drop blank lines that now double up before init marker
        while out and out[-1].strip() == '':
            out.pop()
        continue                    # keep the init marker (do not consume)

    # 4) gateGuard early-return lines
    if 'gateGuard()' in L:
        i += 1
        continue

    # 5) renderAccounts verified-Discord card: if(window.__DSGATE ...) { ... }
    if 'window.__DSGATE && window.__DSGATE.ok' in L:
        i += 1
        while i < n and lines[i].strip() != '}':
            i += 1
        i += 1                      # drop the closing }
        continue

    # 6) init call
    if 'gateInit();' in L:
        i += 1
        continue

    out.append(L)
    i += 1

res = '\n'.join(out) + ('\n' if src.endswith('\n') else '')

# collapse any triple blank lines the removals may have left
res = re.sub(r'\n{4,}', '\n\n\n', res)

open(P, 'w', encoding='utf-8').write(res)

# ---- verification: no real references left (ignore base64 noise) ----
checks = ['DSGATE', 'gateGuard', 'gateShow', 'gateHide', 'gateInit', 'gateBtn', 'gateManual',
          'gateJoin', 'gateMsg', 'gmBox', 'gmPaste', 'gmGo', 'gmErr', 'GM_ERRORS',
          'api/discord', 'auth/discord', 'discord.com', 'dserr', 'dsok', 'gate-card', 'gate-btn',
          'class="gate"', 'id="gate"', 'Verify with Discord', 'Members only']
bad = [c for c in checks if c in res]
# 'discord' as a word (not inside base64): check word-bounded
word_hits = [m.start() for m in re.finditer(r'\bdiscord\b', res, re.I)]
ctx = [res[max(0,p-40):p+40].replace('\n',' ') for p in word_hits[:5]]
print('remaining real refs:', bad if bad else 'NONE')
print('word-bounded "discord" hits:', len(word_hits))
for c in ctx: print('   ...', c)
print('lines before:', n, '| lines after:', len(res.splitlines()))
sys.exit(1 if bad else 0)
