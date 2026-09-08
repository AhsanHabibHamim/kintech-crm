import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function bool(v, def = false) {
  if (v === undefined || v === '') return def;
  return String(v).toLowerCase() === 'true' || v === '1';
}

function int(v, def) {
  const n = Number(v);
  return Number.isFinite(n) && v !== undefined && v !== '' ? n : def;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',
  port: int(process.env.PORT, 5000),
  appUrl: process.env.APP_URL || 'http://localhost:5000',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  domain: process.env.DOMAIN || 'crm.kintechagency.com',

  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
  mongodbName: process.env.MONGODB_NAME || 'kintech_crm',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-insecure-refresh-secret-change-me',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
  },

  totpIssuer: process.env.TOTP_ISSUER || 'KinTech Agency',

  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(__dirname, '../../uploads'),
    s3: {
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET,
      accessKey: process.env.S3_ACCESS_KEY,
      secretKey: process.env.S3_SECRET_KEY,
      region: process.env.S3_REGION || 'us-east-1',
    },
    publicUrl: process.env.PUBLIC_STORAGE_URL || 'http://localhost:5000/uploads',
  },

  mail: {
    host: process.env.SMTP_HOST || '',
    port: int(process.env.SMTP_PORT, 587),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'KinTech CRM <no-reply@kintechagency.com>',
  },

  sms: {
    apiUrl: process.env.SMS_API_URL || '',
    apiKey: process.env.SMS_API_KEY || '',
    sender: process.env.SMS_SENDER || '',
  },

  rateLimit: {
    authWindowMin: int(process.env.RATE_LIMIT_AUTH_WINDOW_MIN, 15),
    authMax: int(process.env.RATE_LIMIT_AUTH_MAX, 20),
    leadWindowMin: int(process.env.RATE_LIMIT_LEAD_WINDOW_MIN, 10),
    leadMax: int(process.env.RATE_LIMIT_LEAD_MAX, 15),
  },

  validation: {
    urlTimeoutMs: int(process.env.VALIDATION_URL_TIMEOUT_MS, 8000),
    geocodingApiUrl: process.env.GEOCODING_API_URL || 'https://nominatim.openstreetmap.org/search',
    leadFollowupDays: int(process.env.LEAD_FOLLOWUP_DAYS, 21),
    lowTrustThreshold: int(process.env.LOW_TRUST_THRESHOLD, 40),
    fraudVelocityMax: int(process.env.FRAUD_VELOCITY_MAX, 10),
    fraudVelocityWindowMin: int(process.env.FRAUD_VELOCITY_WINDOW_MIN, 10),
  },

  defaults: {
    perLeadRate: int(process.env.DEFAULT_PER_LEAD_RATE, 7),
    superLeadBonus: int(process.env.DEFAULT_SUPER_LEAD_BONUS, 200),
    firstWithdrawalLimit: int(process.env.WITHDRAWAL_FIRST_LIMIT, 100),
    subsequentWithdrawalLimit: int(process.env.WITHDRAWAL_SUBSEQUENT_LIMIT, 50),
  },

  backupDir: process.env.BACKUP_DIR || './backups',
};