/* eslint-disable */
// Production process config — `pm2 start ecosystem.config.cjs`
// Runs the API (which also serves the built PWA) + the validation worker.
module.exports = {
  apps: [
    {
      name: 'kintech-api',
      script: 'server/src/index.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '10s',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 8100,
        APP_URL: 'https://crm.kintechagency.com',
        CLIENT_URL: 'https://crm.kintechagency.com',
        PUBLIC_STORAGE_URL: 'https://crm.kintechagency.com/uploads',
      },
    },
    {
      name: 'kintech-worker',
      script: 'server/src/jobs/worker.js',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '10s',
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      // Stable named Cloudflare Tunnel for crm.kintechagency.com -> :8100.
      // One-time setup: cf tunnel login / create kintech / route dns, then `pm2 start ecosystem.config.cjs`.
      // See deploy/tunnel-config.yml. Removed: ephemeral trycloudflare quick tunnel.
      name: 'kintech-cloudflared',
      script: 'deploy/tunnel-named.sh',
      cwd: __dirname,
      interpreter: '/bin/bash',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      min_uptime: '10s',
      time: true,
    },
  ],
};