# KinTech Agency Lead Generation CRM

Production-grade CRM for KinTech Agency (`crm.kintechagency.com`). Lead agents submit leads
from their phone, an auto-validation engine tags them in real time, moderators review, and
commissions + withdrawals are tracked precisely.

## Stack

- **Server:** Node 20+ + Express, `mongodb` (MongoDB 7+), BullMQ + ioredis (Redis 7), JWT auth,
  TOTP 2FA (`otplib`), Multer uploads, Nodemailer
- **Client:** Vite + React 18 + Tailwind v3, PWA (offline-capable lead form), mobile-first
- **Jobs:** auto-validation worker, hourly follow-up sweeper
- **Deploy:** Docker Compose (nginx front, API + worker)

## Roles

| Role | What they do |
| --- | --- |
| Super Admin | Analytics, review, users, payouts, rates, settings, audit log |
| Manager | Review queue, disputes, leads, agent performance, rates (grantable) |
| Lead Agent | Submit leads, track earnings/balance, request withdrawals |

## Quick start (local dev)

Prereqs: Node 20+, MongoDB 7 (or a running replica set / Atlas cluster), Redis 7 running locally.

```bash
npm install                 # installs server + client workspaces
cp .env.example .env        # then adjust credentials (MONGODB_URI / MONGODB_NAME)
npm run migrate             # build indexes idempotently
npm run seed                # create the single admin account + base settings/rates
npm run dev                 # API on :5000 + Vite on :5173 (proxies /api)
# in a second terminal:
npm run worker              # BullMQ validation worker
```

Seed creates **one** super admin only (no demo managers/agents/leads):

```
Super Admin: admin@kintechagency.com / Admin@123
```

> Admin & Manager accounts) must enable **2FA** on first login (the dashboard and API
> block them until it's set up). Lead agents (sales) are not required to enable 2FA.
> Output is available as a QR code in the client.

## Removing seed/demo data

`npm run seed` (or the old demo seed) may have left demo accounts, sample leads and
earnings in the database. Wipe only the demo seed data (keeps the admin account,
settings and commission rates):

```bash
npm run wipe-seed           # deletes demo manager/agents + their leads/earnings
```

## Deploying the frontend on Vercel

The app's database (MongoDB), Redis and the BullMQ worker must keep running on a
server — **Vercel only hosts the static PWA** (built in `client/dist`).

1. Push the repo to GitHub, then import it in Vercel. `vercel.json` sets the build
   command (`npm run build -w client`), output dir (`client/dist`) and an SPA fallback.
2. In the Vercel project, add the env var `VITE_API_URL` pointing at the API, e.g.
   `https://crm.kintechagency.com/api`. (Skip it and the `/api/*` rewrite in
   `vercel.json` proxies to the API on your server instead.)
3. On the server, add the Vercel origin to `CLIENT_URL` so CORS accepts requests, e.g.
   `CLIENT_URL=http://localhost:5173,https://your-app.vercel.app`, then restart the API.
4. Run `npm run build -w client` locally first if you want to preview the same bundle.

API, uploads and the payment-proof screenshots remain served from the server origin.

## Tests

Twenty-nine automated tests cover the money-critical logic (rates, referral override,
balances, eligibility thresholds, disputes), the CSV exporters + watermark, lead
validation incl. social-link/URL checks, and validators/helpers against a throwaway
`kintech_crm_test` MongoDB database:

```bash
npm test
```

## Production deploy without Docker (pm2 + nginx)

The app is a single Express process serving the built PWA, API and `/uploads` on one
origin, so no container runtime is needed:

```bash
cd /home/ahsanhabibhamim/CRM.KinTech
pm2 start ecosystem.config.cjs && pm2 save          # app + worker on :8100
bash deploy/apply-nginx.sh                          # binds port 80 (one sudo command)
```

Details, DNS + TLS steps and lifecycle commands: [deploy/DEPLOY.md](deploy/DEPLOY.md).

## Production deploy (Docker Compose)

```bash
mkdir -p /srv/kintech && cd /srv/kintech   # or clone repo here
cp .env.example .env
# edit .env: strong JWT_SECRET, JWT_REFRESH_SECRET, SMTP_* if emailing agents
docker compose up -d --build
```

That brings up:

- `db` — MongoDB 7 (volume `mongodata`)
- `redis` — Redis 7 (queue backbone)
- `server` — migrates + seeds idempotently, then serves the API on :5000
- `worker` — auto-validation + follow-up jobs
- `client` — nginx on port 80, serving the PWA and proxying `/api` + `/uploads` to the server

Point `crm.kintechagency.com` at this host's public IP. Payment-proof uploads live in the
`uploads` volume. Production-ready single-node replica set (transactions need `replSet`);
backups use `mongodump`-style export.

## Key design decisions

- **Rates are history-tracked.** Each approved lead is credited at the per-lead rate in
  effect at approval time (`commission_rates` newest row wins at event time). Referral
  override is a fixed 5% of the per-lead rate earned by the referrer on the referred
  agent's first 50 approved leads.
- **Lead submission.** Seven fields, fully validated server- and client-side: client name,
  client email, WhatsApp number, main website, **one or more social links**, location,
  and a free-text service note (so agents can specify which service the client wants or
  paste the proposal). Up to 10 social links per lead; every URL is checked.
- **Automatic approvals.** Agents with trust >= 85 whose lead auto-tags `likely_valid`
  skip manual review and are approved instantly.
- **Fraud defense.** Live + on-submit duplicate detection (email & WhatsApp), velocity
  checks, device fingerprinting, and a URL reachability + geocoding authenticity check
  feed the `likely_valid / likely_invalid / needs_review` tag.
- **Withdrawal rules.** First payout unlocks at 100 approved leads, then every 50 after
  the last (non-rejected) payout request. A payout is only `paid` after proof is uploaded.
- **Balance = total earnings − claimed payouts** (requested + processing + paid).
- **CSV exports are watermarked.** Every admin export carries a unique per-file nonce plus
  the exporting admin's id/email and a timestamp in a `# ...` trace row, and each export is
  written to the audit log — so any leaked file can be attributed to its export batch.

## Backups

MongoDB is the source of truth (uploaded payment proofs live in the `uploads` volume).
Run the built-in dump whenever you want a snapshot, and wire it into cron for nightly runs:

```bash
npm run backup                                   # writes backups/kintech-<date>.json.gz
crontab -e                                       # e.g. daily 01:00:
# 0 1 * * * cd /path/to/kintech-crm && ./scripts/backup.sh >> /var/log/kintech-backup.log 2>&1
```

`scripts/backup.sh` keeps the latest 30 dumps and honors `MONGODB_URI` / `BACKUP_DIR`. Only
the single-node replica set's primary is exported — run `mongosh` `rs.status()` to confirm
your cluster is healthy before relying on the dump.

## API surface

See `server/src/routes/*` — grouped as `auth`, `leads`, `review`, `payout`, `admin`,
`manager`, `notifications`, `profile`. All protected endpoints require a bearer JWT;
admin/manager capabilities are enforced per-route.

## Environment

See `.env.example` for every variable: JWT secrets, TOTP issuer, SMTP, SMS (optional),
storage (local or S3-compatible via `S3_*`), default rates, withdrawal thresholds, and
rate limits.