#!/bin/bash
# watchdog.sh — keep XR-Code production server alive on :3000
# checks every 30s; restarts the standalone server if it stops answering
cd /home/z/my-project
while true; do
  code=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$code" != "200" ]; then
    echo "[$(date '+%F %T')] down (code=$code) — restarting"
    pkill -f "standalone/server.js" 2>/dev/null
    sleep 2
    setsid nohup npm start > /tmp/prod.log 2>&1 < /dev/null &
    sleep 12
    code2=$(curl -s -o /dev/null -m 5 -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
    echo "[$(date '+%F %T')] restart -> code=$code2"
  fi
  sleep 30
done
