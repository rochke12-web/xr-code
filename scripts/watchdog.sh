#!/bin/bash
# watchdog.sh v5 — XR-Code 24/7 guardian (gentle: never kills during warmup)
# L1: site liveness every 20s — restart only after 2 consecutive failures
# L2: brain liveness every ~4min — restart only after 4 consecutive failures
#     (v5: brain checks stretched 2min→4min — gateway 429 storms feed on
#      request volume; a 2-min ping with retries keeps the limit saturated)
cd /home/z/my-project
brain_fail=0
site_fail=0
tick=0
last_restart=0
log() { echo "[$(date '+%F %T')] $*" >> /tmp/watchdog.log; }
log "watchdog v5 armed"
while true; do
  tick=$((tick+1))
  now=$(date +%s)
  code=$(curl -s -o /dev/null -m 10 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$code" != "200" ]; then
    site_fail=$((site_fail+1))
    if [ "$site_fail" -ge 2 ] && [ $((now-last_restart)) -ge 60 ]; then
      log "site down 2x (code=$code) — restarting"
      pkill -f "standalone/server.js" 2>/dev/null
      sleep 2
      setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
      sleep 15
      # warm the routes so the first real user never hits a cold path
      curl -s -o /dev/null -m 10 http://localhost:3000/ 2>/dev/null
      curl -s -o /dev/null -m 15 http://localhost:3000/api/health 2>/dev/null
      code2=$(curl -s -o /dev/null -m 10 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
      log "restart+warm -> code=$code2"
      last_restart=$(date +%s)
      site_fail=0
      brain_fail=0
      sleep 5
      continue
    fi
  else
    site_fail=0
  fi
  # L2: brain check every 12th tick (~4 min) — generous, never fires right after a restart
  if [ $((tick % 12)) -eq 0 ] && [ $((now-last_restart)) -ge 90 ]; then
    brain=$(curl -s -m 120 http://localhost:3000/api/chat -X POST -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"ping"}]}' 2>/dev/null)
    if echo "$brain" | grep -q '"ok":true'; then
      brain_fail=0
    else
      brain_fail=$((brain_fail+1))
      log "brain fail #$brain_fail: $(echo "$brain" | head -c 100)"
      if [ "$brain_fail" -ge 4 ] && [ $((now-last_restart)) -ge 120 ]; then
        log "brain dead 3x — restarting to refresh engine"
        pkill -f "standalone/server.js" 2>/dev/null
        sleep 2
        setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
        sleep 15
        curl -s -o /dev/null -m 10 http://localhost:3000/ 2>/dev/null
        last_restart=$(date +%s)
        brain_fail=0
      fi
    fi
  fi
  sleep 20
done
