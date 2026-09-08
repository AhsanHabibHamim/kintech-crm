import { Router } from 'express';
import * as commission from '../services/commissionService.js';
import * as settings from '../services/settingsService.js';
import * as analytics from '../services/analyticsService.js';
import { requireAuth, requireActive, require2fa, requireRole, can } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

/** Manager-scoped endpoints reusing the same service layer, gated by grantable permissions. */
const router = Router();
router.use(requireAuth, requireActive, require2fa, requireRole('super_admin', 'manager'));

router.get('/rates', asyncHandler(async (req, res) => {
  const perLead = await commission.latestRate('per_lead');
  const superLead = await commission.latestRate('super_lead');
  res.json({ per_lead: perLead, super_lead: superLead, can_manage: req.user.role === 'super_admin' || !!req.user.permissions?.manage_rates });
}));

router.post('/rates', can('manage_rates'), asyncHandler(async (req, res) => {
  const { type, amount } = req.body;
  const rate = await commission.setRate({ type, amount, updated_by: req.user.id });
  res.status(201).json({ rate });
}));

router.get('/performance', asyncHandler(async (req, res) => {
  res.json({ rows: await analytics.agentPerformance() });
}));

router.get('/withdrawal-thresholds', asyncHandler(async (req, res) => {
  res.json(await settings.getWithdrawalThresholds());
}));

export default router;