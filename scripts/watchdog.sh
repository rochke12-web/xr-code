#!/bin/bash
# watchdog.sh — keep XR-Code production server AND its AI brain alive on :3000
# checks every 20s; restarts the standalone server if the site is down OR the brain fails
cd /home/z/my-project
brain_fail=0
while true; do
  code=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$code" != "200" ]; then
    echo "[$(date '+%F %T')] site down (code=$code) — restarting"
    pkill -f "standalone/server.js" 2>/dev/null
    sleep 2
    setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
    sleep 12
    code2=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
    echo "[$(date '+%F %T')] restart -> code=$code2"
    brain_fail=0
  else
    # site is up — verify the AI brain actually answers
    brain=$(curl -s -m 45 http://localhost:3000/api/chat -X POST -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"ping"}]}' 2>/dev/null)
    if echo "$brain" | rg -q '"ok":true'; then
      brain_fail=0
    else
      brain_fail=$((brain_fail+1))
      echo "[$(date '+%F %T')] brain fail #$brain_fail: $(echo "$brain" | head -c 120)"
      if [ "$brain_fail" -ge 2 ]; then
        echo "[$(date '+%F %T')] brain dead twice — restarting to refresh engine env"
        pkill -f "standalone/server.js" 2>/dev/null
        sleep 2
        setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
        sleep 12
        brain_fail=0
      fi
    fi
  fi
  sleep 20
done
