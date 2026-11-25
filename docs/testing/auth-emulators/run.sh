#!/usr/bin/env bash
set -euo pipefail

# Invoked by Firebase emulators:exec, from the repository root.
[[ ${FIREBASE_AUTH_EMULATOR_HOST:-} == 127.0.0.1:9099 ]]
[[ ${FIRESTORE_EMULATOR_HOST:-} == 127.0.0.1:8080 ]]
export FIREBASE_PROJECT_ID=demo-libraryflow FIREBASE_WEB_API_KEY=demo-key
export CORS_ORIGIN=http://127.0.0.1:5173 PORT=3000
export VITE_AUTH_MODE=cloud VITE_API_BASE_URL=http://127.0.0.1:3000
export VITE_FIREBASE_PROJECT_ID=$FIREBASE_PROJECT_ID VITE_FIREBASE_API_KEY=demo-key
export VITE_FIREBASE_AUTH_DOMAIN=demo-libraryflow.firebaseapp.com
export VITE_FIREBASE_AUTH_EMULATOR_HOST=$FIREBASE_AUTH_EMULATOR_HOST
unset FIREBASE_PRIVATE_KEY FIREBASE_CLIENT_EMAIL GOOGLE_APPLICATION_CREDENTIALS

node apps/backend/dist/server.js &
api_pid=$!
(cd apps/frontend && exec node ../../node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort) &
ui_pid=$!
trap 'kill "$api_pid" "$ui_pid" 2>/dev/null || true' EXIT
for ((attempt=0; attempt<30; attempt++)); do
  kill -0 "$api_pid" "$ui_pid"
  if curl -fsS "$VITE_API_BASE_URL/health" >/dev/null 2>&1 && curl -fsS "$CORS_ORIGIN" >/dev/null 2>&1; then
    python docs/testing/s2-auth-browser.py
    exit
  fi
  sleep 1
done
echo "LibraryFlow did not start on ports 3000 and 5173." >&2
exit 1
