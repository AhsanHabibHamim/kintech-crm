# Render deploy — crm.kintechagency.com (free tier)

Everything is already prepared in the repo. You only do the steps below.

## 1. Push to GitHub (once)

```bash
cd /home/ahsanhabibhamim/CRM.KinTech
git add -A
git commit -m "init: KinTech CRM with Render deployment"
```

Then create an EMPTY repo on GitHub (github.com → New repository, e.g. `kintech-crm`,
do NOT tick README). Then:

```bash
git remote add origin <your-github-repo-url>
git branch -M main
git push -u origin main
```

## 2. Create the Render service

https://dashboard.render.com → **New → Web Service** → connect your repo →
`kintech-crm`.

- Runtime: **Docker** (Dockerfile is already in the repo root)
- **Plan: Free** (`instance type: Free`)
- Health check path: `/healthz`

## 3. Environment variables (Environment tab)

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://crm.kintechagency.com` |
| `CLIENT_URL` | `https://crm.kintechagency.com` |
| `PUBLIC_STORAGE_URL` | `https://crm.kintechagency.com/uploads` |
| `DOMAIN` | `crm.kintechagency.com` |
| `MONGODB_URI` | `mongodb+srv://erp_kintech:KbJO5ICXdEeZBYwI@cluster0.uegstvt.mongodb.net/?appName=Cluster0` |
| `MONGODB_NAME` | `erp_kintech` |
| `JWT_SECRET` | `4f7ebc5ea8b56574c1bee681ec464e74c7b1a621e9b72931274d1766207ce16b` |
| `JWT_REFRESH_SECRET` | `cee2c2718d72fc5e5f46e7831007cfb9ccb4ca1762c7ba9a6ed9154cd944a541` |
| `TOTP_ISSUER` | `KinTech Agency` |
| `STORAGE_DRIVER` | `local` |
| `TUNNEL_ID` | `03f130df-921e-485e-96f2-1d613236d9d2` |
| `TUNNEL_CRED_B64` | *(below, one line)* |

Do **not** set `PORT` — Render sets it itself. Do **not** set `REDIS_URL` — we run without Redis.

**TUNNEL_CRED_B64** — run this on this PC and paste the output (the base64 of your
existing `kintech.json`, so the container reuses the same tunnel — no DNS change):

```bash
cat ~/.cloudflared/kintech.json | base64 -w0
```

Note: switching `JWT_SECRET` invalidates existing login sessions once. Everyone
re-logs in one time; that is expected and safe.

`STORAGE_DRIVER=local` works immediately, but Render free has NO persistent disk:
payment-proof images disappear on every redeploy/restart. Recommended (free, no
card): set up **Cloudflare R2** and switch to `s3` later — see section 5.

## 4. Go live

Hit **Deploy**. When the deploy succeeds:

- Check the service URL: `https://<service>.onrender.com/healthz` → `{"ok":true}`
- Check the domain: `https://crm.kintechagency.com/healthz` → `{"ok":true}`
- Log in at `https://crm.kintechagency.com`

Then remove the tunnel from the PC so traffic stops splitting (both currently run
the same tunnel):

```bash
pm2 delete kintech-cloudflared
pm2 stop kintech-api kintech-worker
pm2 save
```

Now the PC can be shut down — the site runs 24/7 from Render. Data lives in Atlas.

## 5. (Recommended) Persistent uploads with Cloudflare R2 — free

The app already supports S3. R2 is Cloudflare's S3-compatible storage, 10 GB free,
NO credit card needed. You already own the Cloudflare account for the domain.

1. dashboard.cloudflare.com → your domain's account → **R2 → Create bucket** e.g. `kintech-crm-uploads`
2. R2 → Manage R2 API Tokens → Create → **Object Read & Write** → copy **Account ID**, **Access Key ID**, **Secret Access Key**
3. Render → set these env vars (keep secret), then redeploy:
   - `STORAGE_DRIVER=s3`
   - `S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_BUCKET=kintech-crm-uploads`
   - `S3_ACCESS_KEY=<Access Key ID>`
   - `S3_SECRET_KEY=<Secret Access Key>`
4. Optional one-time: upload the existing `uploads/*` files from the PC into the bucket via your Dashboard UI, so old proofs still load.

## Notes / trade-offs (accepted)

- **No Redis**: BullMQ auto-lead-validation worker and follow-up sweep are OFF.
  Leads still save + notify; they go to manual review (existing fallback flow).
  Rate-limiting is also off (brute-force protection reduced).
- **Cold start**: Free tier sleeps after ~15 min idle; first visit after sleep takes
  ~60 s. That is the Render free trade-off we accepted.
- Free tier has no custom domains — that's why cloudflared runs inside the container.