import { Router } from 'express';
import * as analytics from '../services/analyticsService.js';
import * as users from '../services/userService.js';
import * as commission from '../services/commissionService.js';
import * as settings from '../services/settingsService.js';
import * as auditLog from '../services/auditService.js';
import * as leads from '../services/leadService.js';
import { requireAuth, requireActive, require2fa, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { toCsv, csvResponse, appendWatermark } from '../utils/csv.js';
import { setRate, rateHistory } from '../services/commissionService.js';
import crypto from 'node:crypto';

const router = Router();
router.use(requireAuth, requireActive, require2fa, requireRole('super_admin'));

async function exportCsv(res, kind, columns, rows, req) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const filename = `${kind}-${Date.now()}-${nonce.slice(0, 8)}.csv`;
  const csv = appendWatermark(toCsv(rows, columns), {
    kind,
    nonce,
    userId: req.user.id,
    email: req.user.email,
  });
  await auditLog.audit({
    user_id: req.user.id,
    action: `export_${kind}`,
    target_type: 'export',
    details: { nonce, filename, rows: rows.length },
  });
  csvResponse(res, csv, filename);
}

// ---------- Analytics ----------
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await analytics.dashboardAnalytics();
  const trends = await analytics.monthlyTrends();
  const services = await analytics.servicesBreakdown();
  res.json({ stats, trends, services });
}));

router.get('/leaderboard', asyncHandler(async (req, res) => {
  res.json({ rows: await analytics.leaderboard({ period: req.query.period || 'month' }) });
}));

router.get('/performance', asyncHandler(async (req, res) => {
  res.json({ rows: await analytics.agentPerformance() });
}));

// ---------- Audit log ----------
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const result = await auditLog.listAuditLogs({
    page: req.query.page,
    limit: req.query.limit || 50,
    userId: req.query.user_id,
    action: req.query.action,
  });
  res.json(result);
}));

// ---------- Rates (history-tracked) ----------
router.get('/rates', asyncHandler(async (req, res) => {
  const perLead = await commission.latestRate('per_lead');
  const superLead = await commission.latestRate('super_lead');
  const history = {
    per_lead: (await rateHistory('per_lead')).rows,
    super_lead: (await rateHistory('super_lead')).rows,
  };
  res.json({ per_lead: perLead, super_lead: superLead, history });
}));

router.post('/rates', asyncHandler(async (req, res) => {
  const { type, amount } = req.body;
  const rate = await setRate({ type, amount, updated_by: req.user.id });
  res.status(201).json({ rate });
}));

// ---------- Settings (withdrawal thresholds etc.) ----------
router.get('/settings', asyncHandler(async (req, res) => {
  const [thresholds, referralPercent, followupDays] = await Promise.all([
    settings.getWithdrawalThresholds(),
    settings.getReferralPercent(),
    settings.getFollowupDays(),
  ]);
  res.json({ withdrawal_thresholds: thresholds, referral_override_percent: referralPercent, lead_followup_days: followupDays });
}));

router.post('/settings', asyncHandler(async (req, res) => {
  const body = req.body;
  if (body.withdrawal_thresholds) {
    const t = body.withdrawal_thresholds;
    await settings.setSetting('withdrawal_thresholds', { first: Number(t.first), subsequent: Number(t.subsequent) }, req.user.id);
  }
  if (body.referral_override_percent !== undefined) {
    await settings.setSetting('referral_override_percent', { percent: Number(body.referral_override_percent) }, req.user.id);
  }
  if (body.lead_followup_days !== undefined) {
    await settings.setSetting('lead_followup_days', { days: Number(body.lead_followup_days) }, req.user.id);
  }
  res.json({ message: 'Settings updated.' });
}));

// ---------- CSV export (lead/agent/payout) ----------
const LEAD_COLUMNS = {
  'Lead ID': 'id',
  'Agent (Submitter)': 'agent_name',
  'Client Name': 'client_name',
  'Email': 'email',
  'WhatsApp': 'whatsapp_number',
  'Website': 'website_url',
  'Social Links': 'social_links',
  'Location': 'location',
  'Category': 'category',
  'Sub-Service': 'sub_service',
  'Client Niche': 'client_niche',
  'Service': 'service_interested_in',
  'Status': 'status',
  'Auto Tag': 'auto_validation_tag',
  'Super Lead': 'is_super_lead',
  'Disputed': 'dispute_requested',
  'Followup Flag': 'followup_flag',
  'Accepted By': 'reviewer_name',
  'Reviewed At': 'reviewed_at',
  'Created At': 'created_at',
};

router.get('/export/leads', asyncHandler(async (req, res) => {
  const { rows } = await leads.listLeads({
    filters: req.query,
    page: 1,
    limit: 20000,
  });
  await exportCsv(res, 'leads', LEAD_COLUMNS, rows, req);
}));

router.get('/export/agents', asyncHandler(async (req, res) => {
  const rows = await analytics.agentPerformance();
  await exportCsv(res, 'agents', {
    'Agent ID': 'id', 'Name': 'name', 'Email': 'email', 'Trust Score': 'trust_score',
    'Total Leads': 'total_leads', 'Approved': 'approved_leads', 'Rejected': 'rejected_leads',
    'Super Leads': 'super_leads', 'Total Earned': 'total_earnings', 'Accept Rate %': 'accept_rate',
  }, rows, req);
}));

router.get('/export/payouts', asyncHandler(async (req, res) => {
  const { listPayouts } = await import('../services/payoutService.js');
  const { rows } = await listPayouts({ filters: req.query, page: 1, limit: 20000 });
  await exportCsv(res, 'payouts', {
    'Payout ID': 'id', 'Agent': 'agent_name', 'Amount': 'amount', 'Method': 'method',
    'Account': 'account_number', 'Status': 'status', 'Processed': 'processed_at', 'Created': 'created_at',
  }, rows, req);
}));

// ---------- User management ----------
router.get('/users', asyncHandler(async (req, res) => {
  const result = await users.listUsers({ filters: req.query, page: req.query.page, limit: req.query.limit || 25 });
  const pendingStats = await users.pendingAgentStats();
  res.json({ ...result, pending_stats: pendingStats });
}));

router.post('/users', asyncHandler(async (req, res) => {
  const user = await users.createUser({ ...req.body, barAdmin: req.user.id });
  res.status(201).json({ user });
}));

router.post('/agents/:id/approve', asyncHandler(async (req, res) => {
  const user = await users.approveAgent(Number(req.params.id), req.user.id);
  res.json({ user });
}));

router.post('/agents/:id/reject', asyncHandler(async (req, res) => {
  await users.rejectAgent(Number(req.params.id), req.user.id);
  res.json({ success: true });
}));

router.patch('/users/:id/status', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'You cannot change your own status.' });
  const user = await users.toggleUserStatus(Number(req.params.id), req.body.status, req.user.id);
  res.json({ user });
}));

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'You cannot change your own role.' });
  const user = await users.changeUserRole(Number(req.params.id), req.body.role, req.user.id);
  res.json({ user });
}));

router.patch('/users/:id/permission', asyncHandler(async (req, res) => {
  const user = await users.setUserPermission(Number(req.params.id), req.body.permission, req.body.value, req.user.id);
  res.json({ user });
}));

router.post('/users/:id/reset-password', asyncHandler(async (req, res) => {
  await users.resetUserPassword(Number(req.params.id), req.body.new_password, req.user.id);
  res.json({ message: 'Password reset.' });
}));

export default router;