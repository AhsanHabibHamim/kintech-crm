#!/usr/bin/env bash
# Persists the current ephemeral trycloudflare.com public URL under logs/tunnel-url.txt
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
~/bin/cloudflared tunnel --url http://localhost:8100 --no-autoupdate 2>&1 | tee /dev/null | while IFS= read -r line; do
  url="$(printf '%s\n' "$line" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | head -1 || true)"
  if [ -n "$url" ]; then printf '%s\n' "$url" > logs/tunnel-url.txt; fi
done