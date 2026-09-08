# KinTech CRM — Production Deployment (rootless: pm2 + nginx)

The app runs as a **single Express process** that serves the built PWA, the JSON API and
`/uploads` on one origin, plus a BullMQ worker. This avoids needing Docker on the host.

## Runtime topology

```
Internet:80 ──> nginx (deploy/nginx.conf) ──> 127.0.0.1:8100 (kintech-api, pm2)
                                                       ├── serves client/dist (built PWA)
                                                       ├── /api/* (JSON API)
                                                       └── /uploads/* (static files)
kintech-worker (pm2) ── BullMQ ──> Redis :6379
both ──> MongoDB 127.0.0.1:27017 (single-node replSet rs0, kintech_crm)
```

## Deployed on this machine

| Item                        | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| API + PWA origin            | `http://localhost:8100` (pm2 `kintech-api`)            |
| Worker                      | pm2 `kintech-worker` (`server/src/jobs/worker.js`)     |
| Config                      | `ecosystem.config.cjs` (NODE_ENV=production, PORT 8100)|
| Autostart                   | `@reboot pm2 resurrect` (crontab), `pm2 save` applied  |
| Backups                     | `npm run backup` -> `backups/kintech-<date>.json.gz` |
| Database                    | MongoDB on `127.0.0.1:27017` (replSet `rs0`); start/repair via `scripts/mongodb-local.sh`, autostarted from cron (`@reboot`)|

Manage: `pm2 status`, `pm2 logs kintech-api`, `pm2 restart kintech-api deploy`.

## Landing (first deploy) — one admin only

```bash
cd /home/ahsanhabibhamim/CRM.KinTech
npm run wipe-seed     # deletes demo manager/agents + their leads/earnings (if any)
npm run seed          # idempotent: keeps settings/rates, creates the single admin if absent
pm2 restart kintech-api
```

Demo entries from the old seed (manager@ / agent1..3@kintechagency.com) cannot log in
once wiped. The only account is `admin@kintechagency.com / Admin@123`; enable 2FA on first
login (admin/manager dashboard & API are blocked until 2FA is set up).

## Vercel frontend (optional)

`vercel.json` at the repo root deploys the built PWA (`client/dist`) on Vercel. Set
`VITE_API_URL` (e.g. `https://crm.kintechagency.com/api`) in the Vercel project and add
the Vercel origin to `CLIENT_URL` in `.env` (comma-separated) so CORS works, then restart
the API.

## Connecting a CLOUD database

The app needs only two variables — `MONGODB_URI` and `MONGODB_NAME` in `.env`. Today it
points to the local single-node replica set on `127.0.0.1:27017`. To move the database
into the cloud:

1. Spin up a managed MongoDB 6+ (Atlas, DigitalOcean, Railway, …) and enable a replica set
   — **transactions are required**, so a standalone single node will not work.
2. Put it in `.env`:
   ```
   MONGODB_URI=mongodb://user:pass@your-cluster.example.com:27017/?replicaSet=rs0
   MONGODB_NAME=kintech_crm
   ```
3. Run `npm run migrate` then `npm run seed` **once** against the new host (this creates the
   indexes + the single admin). The official `mongodb` driver runs on any Mongo 6+.
4. Restart the API + worker: `pm2 restart kintech-api kintech-worker`.
5. Redis/BullMQ (validation + follow-up jobs) can stay on this host or move to a managed
   Redis (Upstash) by changing `REDIS_URL`.

The database is **never exposed to the browser** — only the API talks to it. The Vercel
frontend talks to the API only.

## Domain + TLS (registrar DNS)

This host's public IP is `103.253.47.154`. In your registrar's DNS panel:

- **Whole app on this server (simplest):** point the `@` / `A` record to `103.253.47.154`,
  run `bash deploy/apply-nginx.sh`, then `sudo certbot --nginx -d yourdomain.com`.
- **Frontend on Vercel + API here:** give the server a subdomain, e.g. `api` →
  `A 103.253.47.154`, and point the Vercel custom domain to Vercel's nameservers/CNAME.
  Expose the API as `https://api.yourdomain.com` and set that as `VITE_API_URL` + CORS.

Don't rely on the temporary `logs/tunnel-url.txt` (cloudflared) URL for production.

## Reachable right now (no root needed)

- On this machine: `http://localhost:8100`
- Any device on the same Wi-Fi: `http://192.168.43.52:8100`

## Remaining (needs one sudo command)

```bash
bash /home/ahsanhabibhamim/CRM.KinTech/deploy/apply-nginx.sh
```

This installs `deploy/nginx.conf` into nginx, reloads it and prints next steps:
DNS (`A` record `crm.kintechagency.com` -> this host's public IP) and TLS
(`sudo certbot --nginx -d crm.kintechagency.com`).

## Verify after DNS + TLS

- `curl -s https://crm.kintechagency.com/healthz` -> `{"ok":true,...}`
- Open `https://crm.kintechagency.com/login`, sign in with a seed account, submit a lead.
- `pm2 logs kintech-worker` should show validation jobs processing.

## Notes / gotchas

- Port 8000 was already taken by an unknown process on this host, so prod uses **8100**.
- Production env is set inside `ecosystem.config.cjs`; it overrides `.env` for
  `NODE_ENV`, `PORT`, `APP_URL`, `CLIENT_URL`, `PUBLIC_STORAGE_URL`.
- Helmet applies its default CSP in production, and HTTP traces are `morgan` "combined".
- The old dev stack (Vite :5173 + API :5000 + setuid workers) is stopped during deploy;
  restart it anytime with `npm run dev` in `server/` + `client/`.