#!/bin/bash
# watchdog.sh v6 — XR-Code 24/7 guardian (gentle: never kills during warmup)
# L1: site liveness every 20s — restart only after 2 consecutive failures
# L2 brain ping: REMOVED in v6 — every synthetic chat POST burns the shared
#     gateway quota (429 storms) and a restart can't fix an upstream limit.
#     Engine health is judged only by real user traffic now.
cd /home/z/my-project
brain_fail=0
site_fail=0
tick=0
last_restart=0
log() { echo "[$(date '+%F %T')] $*" >> /tmp/watchdog.log; }
log "watchdog v6 armed (L1 only — no brain pings, quota stays for real users)"
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
  # L2 removed (v6): no synthetic brain pings — see header comment
  sleep 20
done
