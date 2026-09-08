#!/usr/bin/env bash
# Run the stable named Cloudflare Tunnel for crm.kintechagency.com.
# Requires: cloudflared tunnel login + create + route dns (see tunnel-config.yml).
set -euo pipefail
cd "$(dirname "$0")/.."
exec ~/bin/cloudflared tunnel --config "$(realpath deploy/tunnel-config.yml)" run kintech