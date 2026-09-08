# KinTech CRM — Render web service image.
# Runs the Express API (serving the built PWA) plus an in-container
# cloudflared that keeps crm.kintechagency.com on the same stable tunnel.

FROM node:20-slim

WORKDIR /app

# cloudflared (same tunnel as the PC currently runs) — x86_64 (Render amd64).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared \
    && chmod +x /usr/local/bin/cloudflared \
    && rm -rf /var/lib/apt/lists/*

# Install deps BEFORE copying source so Docker layer cache survives edits.
COPY package.json package-lock.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm ci

# Source + build the PWA (devDeps already installed above, NODE_ENV not set yet).
COPY . .
RUN npm run build -w client

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bash", "deploy/render-start.sh"]