#!/bin/bash
# XR-Code live e2e test: restart server, then verify DeepSeek-only koder,
# Google-powered QnA with Sources, and the agent loop. All in ONE call so the
# freshly started server stays alive for the whole run.
cd /home/z/my-project
pkill -f "standalone/server.js" 2>/dev/null; sleep 2
setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
sleep 12
echo "HEALTH: $(curl -s -m 10 http://localhost:3000/api/health)"

post() { # $1 label, $2 json
  echo "---- $1 ----"
  curl -s -m 150 -X POST http://localhost:3000/api/chat \
    -H "Content-Type: application/json" -d "$2" | head -c 1200
  echo
}

post "KODER (expect engine dpsk-*)" \
  '{"mode":"koder","messages":[{"role":"user","content":"write a one-line python function to reverse a string"}]}'

post "QNA news (expect Sources with google news links)" \
  '{"mode":"qna","messages":[{"role":"user","content":"Who is the president of France right now?"}]}'

post "QNA evergreen (expect Sources via DDG/general web)" \
  '{"mode":"qna","messages":[{"role":"user","content":"What is the capital of Australia?"}]}'

post "AGENT (expect Agent trace + dpsk engine)" \
  '{"mode":"agent","messages":[{"role":"user","content":"Search the web for the current population of Japan and give me the number."}]}'

echo "---- done ----"
