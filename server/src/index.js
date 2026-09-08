import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { s3Enabled, getObject } from './services/storage.js';
import { notFound, errorHandler } from './middleware/error.js';
import { close as closeDb } from './db/mongodb.js';
import authRoutes from './routes/auth.routes.js';
import leadRoutes from './routes/leads.routes.js';
import reviewRoutes from './routes/review.routes.js';
import payoutRoutes from './routes/payout.routes.js';
import adminRoutes from './routes/admin.routes.js';
import managerRoutes from './routes/manager.routes.js';
import notifRoutes from './routes/notifications.routes.js';
import profileRoutes from './routes/profile.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: config.isProd ? undefined : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({ origin: config.clientUrl.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

// Static proof images (payment screenshots) + any public uploads.
// S3/R2 (if enabled) backs the local disk so files survive instance restarts.
fs.mkdirSync(config.storage.localDir, { recursive: true });
app.use('/uploads', express.static(config.storage.localDir, { maxAge: '7d', fallthrough: true }));
if (s3Enabled()) {
  app.use('/uploads', async (req, res) => {
    const key = decodeURIComponent(req.path).replace(/^\/+/, '').split('?')[0];
    if (!key) return res.status(404).end();
    const obj = await getObject(key);
    if (!obj || !obj.stream) return res.status(404).end();
    res.setHeader('Content-Type', obj.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'max-age=604800');
    obj.stream.pipe(res);
  });
}
app.use('/healthz', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/profile', profileRoutes);

// Production: serve the built client from the same origin (PWA + API on one host),
// with an SPA fallback to index.html for any non-API route.
if (config.isProd) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    console.warn('[server] NODE_ENV=production but client/dist not built — serving API only.');
  }
}

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  console.log(`[server] KinTech CRM listening on ${config.appUrl}`);
});

async function shutdown(signal) {
  console.log(`[server] ${signal} — shutting down gracefully`);
  server.close(async () => {
    await closeDb().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));