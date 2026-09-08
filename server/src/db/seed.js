import bcrypt from 'bcryptjs';
import { col, insertOne, close } from './mongodb.js';
import { config } from '../config.js';
import { referralCode } from '../utils/helpers.js';

const EMAIL = 'admin@kintechagency.com';
const PASSWORD = 'Admin@123';

async function seed() {
  const settings = [
    ['withdrawal_thresholds', { first: config.defaults.firstWithdrawalLimit, subsequent: config.defaults.subsequentWithdrawalLimit }],
    ['referral_override_percent', { percent: 5 }],
    ['lead_followup_days', { days: config.validation.leadFollowupDays }],
  ];
  for (const [key, value] of settings) {
    await col('settings').updateOne(
      { _id: key },
      { $setOnInsert: { value, updated_at: new Date() } },
      { upsert: true },
    );
  }

  const rates = await col('commission_rates').countDocuments();
  if (rates === 0) {
    await insertOne('commission_rates', { type: 'per_lead', amount: config.defaults.perLeadRate, effective_from: new Date() });
    await insertOne('commission_rates', { type: 'super_lead', amount: config.defaults.superLeadBonus, effective_from: new Date() });
  }

  const existingAdmin = await col('users').findOne({ role: 'super_admin' });
  if (existingAdmin) {
    console.log('[seed] super admin already exists — skipping account creation.');
    return;
  }

  const hash = bcrypt.hashSync(PASSWORD, 10);
  await insertOne('users', {
    name: 'KinTech Super Admin',
    email: EMAIL,
    phone: '+8801700000001',
    password_hash: hash,
    role: 'super_admin',
    status: 'active',
    referral_code: referralCode(),
    token_version: 0,
    terms_accepted: true,
    terms_accepted_at: new Date(),
    permissions: {},
  });

  console.log('[seed] created single admin account:');
  console.log(`   Super Admin: ${EMAIL} / ${PASSWORD}`);

  await close();
}

seed().catch(async (e) => {
  console.error('[seed] failed:', e);
  await close().catch(() => {});
  process.exit(1);
});