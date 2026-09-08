#!/usr/bin/env bash
# Render container entrypoint.
# 1. Materialises the Cloudflare tunnel credentials from env (TUNNEL_ID + TUNNEL_CRED_B64).
# 2. Starts the SAME `kintech` tunnel inside the container, so
#    https://crm.kintechagency.com keeps pointing at this app with no DNS change.
# 3. Runs the API on $PORT (Render sets PORT). Without tunnel envs, runs API only.

set -euo pipefail

PORT="${PORT:-8080}"
CFG_DIR="/app/.cloudflared"
TUNNEL_ID="${TUNNEL_ID:-kintech}"
TUNNEL_CRED_FILE="${CFG_DIR}/${TUNNEL_ID}.json"

if [ -n "${TUNNEL_CRED_B64:-}" ]; then
  mkdir -p "${CFG_DIR}"
  echo "${TUNNEL_CRED_B64}" | base64 -d > "${TUNNEL_CRED_FILE}"
  chmod 600 "${TUNNEL_CRED_FILE}"

  cat > "${CFG_DIR}/config.yml" <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: ${TUNNEL_CRED_FILE}
ingress:
  - hostname: crm.kintechagency.com
    service: http://127.0.0.1:${PORT}
  - service: http_status:404
EOF

  /usr/local/bin/cloudflared tunnel --config "${CFG_DIR}/config.yml" run "${TUNNEL_ID}" &
  echo "[start] cloudflared tunnel '${TUNNEL_ID}' started (pid $!) -> :${PORT}"
fi

echo "[start] launching API on :${PORT}"
exec node server/src/index.js