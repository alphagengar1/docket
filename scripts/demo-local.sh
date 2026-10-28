#!/bin/zsh
# Fully offline demo: local Convex backend on 127.0.0.1:3210 with the 20 recordings, DEMO_REPLAY=1, web on 5173.
# Console http://localhost:5173/  board http://localhost:5173/#/board  phone http://localhost:5173/#/borrower
set -e
cd "$(dirname "$0")/.."
export PATH="/Users/swrj/.nvm/versions/node/v22.18.0/bin:$PATH"
./node_modules/.bin/convex deployment select local >/dev/null
pkill -f "convex dev --typecheck disable" 2>/dev/null || true
(nohup ./node_modules/.bin/convex dev --typecheck disable </dev/null > /tmp/docket-convex-local.log 2>&1 &)
for i in $(seq 1 60); do grep -q "Convex functions ready" /tmp/docket-convex-local.log 2>/dev/null && break; sleep 2; done
./node_modules/.bin/convex env set DEMO_REPLAY 1 >/dev/null
cp web/.env.local /tmp/docket-web-env.cloud.bak 2>/dev/null || true
echo "VITE_CONVEX_URL=http://127.0.0.1:3210" > web/.env.local
pkill -f "vite --port 5173" 2>/dev/null || true
(cd web && nohup ./node_modules/.bin/vite --port 5173 --strictPort </dev/null > /tmp/docket-vite.log 2>&1 &)
sleep 3
echo "Offline demo ready: http://localhost:5173 (console), #/board, #/borrower. Every card code replays its recording."
