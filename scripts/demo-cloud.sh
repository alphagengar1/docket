#!/bin/zsh
# Back to the cloud deployment (live site data, DEMO_REPLAY as set there).
set -e
cd "$(dirname "$0")/.."
export PATH="/Users/swrj/.nvm/versions/node/v22.18.0/bin:$PATH"
./node_modules/.bin/convex deployment select dev:warmhearted-seahorse-595 >/dev/null 2>&1 || sed -i '' 's/^CONVEX_DEPLOYMENT=.*/CONVEX_DEPLOYMENT=dev:warmhearted-seahorse-595/' .env.local
echo "VITE_CONVEX_URL=https://warmhearted-seahorse-595.convex.cloud" > web/.env.local
pkill -f "convex dev --typecheck disable" 2>/dev/null || true
(nohup ./node_modules/.bin/convex dev --typecheck disable </dev/null > /tmp/docket-convex-cloud.log 2>&1 &)
pkill -f "vite --port 5173" 2>/dev/null || true
(cd web && nohup ./node_modules/.bin/vite --port 5173 --strictPort </dev/null > /tmp/docket-vite.log 2>&1 &)
sleep 3
echo "Cloud mode: web at http://localhost:5173 pointed at warmhearted-seahorse-595."
