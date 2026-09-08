import { Router } from 'express';
import * as svc from '../services/payoutService.js';
import { requireAuth, requireActive, require2fa, requireRole, can } from '../middleware/auth.js';
import { uploadProof } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();

// ---------- Agent side ----------
router.get('/me/eligibility', requireAuth, requireActive, asyncHandler(async (req, res) => {
  if (req.user.role !== 'lead_agent') return res.status(403).json({ message: 'Only lead agents have withdrawal eligibility.' });
  const eligibility = await svc.payoutEligibility(req.user.id);
  res.json(eligibility);
}));

router.get('/me', requireAuth, requireActive, asyncHandler(async (req, res) => {
  const { rows, total } = await svc.listPayouts({ agentId: req.user.id, page: req.query.page, limit: req.query.limit || 20 });
  res.json({ rows, total });
}));

router.get('/me/summary', requireAuth, requireActive, asyncHandler(async (req, res) => {
  const { agentEarningsSummary, agentBalance } = await import('../services/commissionService.js');
  const summary = await agentEarningsSummary(req.user.id);
  const balance = await agentBalance(req.user.id);
  res.json({ ...summary, ...balance });
}));

router.get('/me/ledger', requireAuth, requireActive, asyncHandler(async (req, res) => {
  const { agentEarningsLedger } = await import('../services/commissionService.js');
  const result = await agentEarningsLedger(req.user.id, { page: req.query.page, limit: req.query.limit || 30 });
  res.json(result);
}));

router.post('/request', requireAuth, requireActive, asyncHandler(async (req, res) => {
  if (req.user.role !== 'lead_agent') return res.status(403).json({ message: 'Only lead agents can request payouts.' });
  const payout = await svc.requestPayout({
    agent: req.user,
    method: req.body.method,
    account_number: req.body.account_number,
    amount: req.body.amount,
  });
  res.status(201).json({ payout, message: 'Payout request submitted. An administrator will process it.' });
}));

// ---------- Admin / manager processing side ----------
router.get('/', requireAuth, requireActive, require2fa, requireRole('super_admin', 'manager'), asyncHandler(async (req, res) => {
  const { rows, total, page } = await svc.listPayouts({ filters: req.query, page: req.query.page, limit: req.query.limit || 20 });
  const stats = await svc.payoutStats();
  res.json({ rows, total, page, stats });
}));

router.patch(
  '/:id/status',
  requireAuth,
  requireActive,
  require2fa,
  requireRole('super_admin', 'manager'),
  can('manage_payouts'),
  uploadProof.single('proof'),
  asyncHandler(async (req, res) => {
    const payout = (await svc.listPayouts({ filters: { id: req.params.id } })).rows[0];
    if (!payout) return res.status(404).json({ message: 'Payout request not found.' });
    const updated = await svc.updatePayoutStatus({
      payout,
      admin: req.user,
      status: req.body.status,
      note: req.body.note,
      proofFile: req.file || null,
    });
    res.json({ payout: updated });
  }),
);

export default router;