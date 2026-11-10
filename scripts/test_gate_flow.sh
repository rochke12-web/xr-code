#!/bin/bash
# E2E test of the new Discord gate flow (popup + cross-origin handoff)
set -e
B=http://localhost:3000
RET='https://preview-chat-caecb24c-b927-48e1-93b7-2fa2e52b34a9.space-z.ai'
SECRET=$(rg -o 'XR_AUTH_SECRET=(\S+)' -r '$1' /home/z/my-project/.env)

echo "== A. start?popup=1&ret=preview =="
curl -sS -D /tmp/a.h -o /dev/null "$B/auth/discord/start?popup=1&ret=$(python3 -c "import urllib.parse;print(urllib.parse.quote('$RET',safe=''))")"
rg -i '^(HTTP|location|set-cookie)' /tmp/a.h
LOC=$(rg -io 'location: (\S+)' -r '$1' /tmp/a.h | head -1)
STATE=$(python3 -c "
from urllib.parse import urlparse, parse_qs
print(parse_qs(urlparse('$LOC').query)['state'][0])")
RAND=$(python3 -c "print('$STATE'.split('.')[0])")
RETB64=$(python3 -c "print('$STATE'.split('.')[1] if '.' in '$STATE' else '')")
python3 - "$RETB64" <<'EOF'
import sys, base64
pad = '=' * (-len(sys.argv[1]) % 4)
print("decoded ret:", base64.urlsafe_b64decode(sys.argv[1] + pad))
EOF
echo "state=$STATE"

echo "== B. plain start (no popup/ret) =="
curl -sS -D /tmp/b.h -o /dev/null "$B/auth/discord/start"
rg -i '^(location|set-cookie)' /tmp/b.h
BSTATE=$(python3 -c "
from urllib.parse import urlparse, parse_qs
import re
loc = re.search(r'location: (\S+)', open('/tmp/b.h').read(), re.I).group(1)
print(parse_qs(urlparse(loc).query)['state'][0])")
echo "plain state has no ret dot: $([[ $BSTATE != *.* ]] && echo OK || echo FAIL)"

echo "== C. cross-origin callback, no code -> handoff#e=setup =="
curl -sS -D - -o /dev/null "$B/auth/discord/callback?state=$STATE" | rg -i '^(HTTP|location)'

echo "== C2. cross-origin callback, access_denied -> handoff#e=denied =="
curl -sS -D - -o /dev/null "$B/auth/discord/callback?error=access_denied&state=$STATE" | rg -i '^(HTTP|location)'

echo "== D. same-origin callback, matching cookie, no code -> dserr=setup =="
curl -sS -D - -o /dev/null -H "Cookie: xr_state=$BSTATE" "$B/auth/discord/callback?state=$BSTATE" | rg -i '^(HTTP|location)'

echo "== E. same-origin callback, WRONG cookie -> dserr=state =="
curl -sS -D - -o /dev/null -H "Cookie: xr_state=deadbeef" "$B/auth/discord/callback?state=$BSTATE" | rg -i '^(HTTP|location)'

echo "== F. handoff token roundtrip (mint locally, exchange via API) =="
TOK=$(node -e "
const { createHmac } = require('crypto');
const secret = '$SECRET';
const uid = '123456789012345678';
const iat = Math.floor(Date.now()/1000);
const rand = '$RAND';
const sig = createHmac('sha256', secret).update('handoff.'+uid+'.'+iat+'.'+rand).digest('hex').slice(0,40);
console.log('h1.'+uid+'.'+iat+'.'+rand+'.'+sig);
")
echo "token=$TOK"
curl -sS -D /tmp/f.h -X POST "$B/api/discord/handoff" -H 'Content-Type: application/json' \
  -H "Cookie: xr_state=$RAND" -d "{\"token\":\"$TOK\"}"
echo
XRDS=$(rg -io 'set-cookie: (xr_ds=[^;]+)' -r '$1' /tmp/f.h | head -1)
echo "cookie: $XRDS"
echo "-- check with minted cookie:"
curl -sS -X POST "$B/api/discord/check" -H "Cookie: $XRDS" -d '{}'
echo

echo "== F2. handoff with WRONG state cookie -> state error =="
curl -sS -X POST "$B/api/discord/handoff" -H 'Content-Type: application/json' \
  -H "Cookie: xr_state=ffffff" -d "{\"token\":\"$TOK\"}"
echo
echo "== F3. handoff with NO state cookie -> state error =="
curl -sS -X POST "$B/api/discord/handoff" -H 'Content-Type: application/json' -d "{\"token\":\"$TOK\"}"
echo
echo "== F4. handoff with EXPIRED token =="
OLDTOK=$(node -e "
const { createHmac } = require('crypto');
const secret = '$SECRET';
const uid = '123456789012345678';
const iat = Math.floor(Date.now()/1000) - 300;
const rand = '$RAND';
const sig = createHmac('sha256', secret).update('handoff.'+uid+'.'+iat+'.'+rand).digest('hex').slice(0,40);
console.log('h1.'+uid+'.'+iat+'.'+rand+'.'+sig);
")
curl -sS -X POST "$B/api/discord/handoff" -H 'Content-Type: application/json' \
  -H "Cookie: xr_state=$RAND" -d "{\"token\":\"$OLDTOK\"}"
echo
echo "== F5. tampered token =="
curl -sS -X POST "$B/api/discord/handoff" -H 'Content-Type: application/json' \
  -H "Cookie: xr_state=$RAND" -d "{\"token\":\"${TOK%?}X\"}"
echo

echo "== G. tiny pages render =="
curl -sS -o /tmp/done.html -w "done:%{http_code} " "$B/auth/discord/done"
curl -sS -o /tmp/hoff.html -w "handoff:%{http_code}\n" "$B/auth/discord/handoff"
rg -o 'Verified|Not verified' /tmp/done.html | head -1
rg -o 'Verification session expired' /tmp/hoff.html | head -1

echo "== H. chat fail-closed without cookie, then allowed with cookie =="
curl -sS -o /tmp/c1.json -w "no-cookie chat:%{http_code}\n" -X POST "$B/api/chat" -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}'
head -c 200 /tmp/c1.json; echo
curl -sS -o /tmp/c2.json -w "with-cookie chat:%{http_code}\n" -X POST "$B/api/chat" -H 'Content-Type: application/json' -H "Cookie: $XRDS" -d '{"messages":[{"role":"user","content":"say ok"}]}'
head -c 160 /tmp/c2.json; echo
echo "ALL DONE"
