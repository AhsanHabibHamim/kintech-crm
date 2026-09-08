#!/usr/bin/env bash
# One-command deployment step (requires sudo for binding port 80).
# Usage: bash deploy/apply-nginx.sh
set -euo pipefail

sudo install -m 644 deploy/nginx.conf /etc/nginx/sites-available/kintech
sudo ln -sf /etc/nginx/sites-available/kintech /etc/nginx/sites-enabled/kintech
sudo nginx -t
sudo systemctl reload nginx

echo "OK — http://crm.kintechagency.com is now served by nginx -> 127.0.0.1:8100"
echo "Next: point the DNS A record for crm.kintechagency.com at this host's public IP."
echo "TLS:  sudo certbot --nginx -d crm.kintechagency.com"