#!/bin/bash
# watchdog.sh v3 — XR-Code 24/7 guardian (safe: never kills a healthy server)
# Layer 1 (every 20s): site liveness — restart standalone server if :3000 is down
# Layer 2 (every ~2min): brain liveness — restart only after 3 CONSECUTIVE brain failures
cd /home/z/my-project
brain_fail=0
tick=0
log() { echo "[$(date '+%F %T')] $*" >> /tmp/watchdog.log; }
log "watchdog v3 armed"
while true; do
  tick=$((tick+1))
  code=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$code" != "200" ]; then
    log "site down (code=$code) — restarting"
    pkill -f "standalone/server.js" 2>/dev/null
    sleep 2
    setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
    sleep 14
    code2=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
    log "restart -> code=$code2"
    brain_fail=0
    sleep 6
    continue
  fi
  # Layer 2: brain check every 6th tick (~2 min), generous timeout (engine has internal retries)
  if [ $((tick % 6)) -eq 0 ]; then
    brain=$(curl -s -m 120 http://localhost:3000/api/chat -X POST -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"ping"}]}' 2>/dev/null)
    if echo "$brain" | grep -q '"ok":true'; then
      brain_fail=0
    else
      brain_fail=$((brain_fail+1))
      log "brain fail #$brain_fail: $(echo "$brain" | head -c 100)"
      if [ "$brain_fail" -ge 3 ]; then
        log "brain dead 3x — restarting to refresh engine"
        pkill -f "standalone/server.js" 2>/dev/null
        sleep 2
        setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
        sleep 14
        brain_fail=0
      fi
    fi
  fi
  sleep 20
done
