import { col, close } from './mongodb.js';

const DEMO_EMAILS = [
  'manager@kintechagency.com',
  'agent1@kintechagency.com',
  'agent2@kintechagency.com',
  'agent3@kintechagency.com',
];

async function wipeSeed() {
  const users = await col('users')
    .find({ email: { $in: DEMO_EMAILS.map((e) => e.toLowerCase()) } })
    .toArray();
  const ids = users.map((r) => r.id);

  if (ids.length === 0) {
    console.log('[wipe-seed] no demo seed users found — nothing to wipe.');
    return;
  }

  await col('notifications').deleteMany({ user_id: { $in: ids } });
  await col('payout_requests').deleteMany({ agent_id: { $in: ids } });
  await col('earnings').deleteMany({ $or: [{ agent_id: { $in: ids } }, { note: 'seeded' }] });
  await col('leads').deleteMany({ agent_id: { $in: ids } });
  await col('audit_logs').deleteMany({ $or: [{ user_id: { $in: ids } }, { target_id: { $in: ids } }] });
  await col('users').updateMany({ referred_by: { $in: ids } }, { $set: { referred_by: null } });
  await col('users').deleteMany({ id: { $in: ids } });

  console.log(`[wipe-seed] removed demo seed data (${users.map((r) => r.email).join(', ')}).`);
  await close();
}

wipeSeed().catch(async (e) => {
  console.error('[wipe-seed] failed:', e);
  await close().catch(() => {});
  process.exit(1);
});