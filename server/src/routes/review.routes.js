import { Router } from 'express';
import * as svc from '../services/leadService.js';
import { requireAuth, requireActive, require2fa, requireRank } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { recomputeTrustScore } from '../services/analyticsService.js';

const router = Router();
router.use(requireAuth, requireActive, require2fa, requireRank(1)); // manager+ (rank 1)

/** Moderator queue — leads needing review, sortable by auto-validation tag. */
router.get('/queue', asyncHandler(async (req, res) => {
  const statuses = req.query.status
    ? req.query.status.split(',')
    : ['pending', 'under_review', 'needs_info'];
  const filters = { ...req.query, status: undefined };
  const { rows, total, page } = await svc.listLeads({
    filters: { ...filters, statuses },
    page: req.query.page,
    limit: req.query.limit || 20,
  });
  res.json({ rows, total, page });
}));

router.get('/lead/:id', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  res.json({ lead });
}));

router.post('/:id', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  const { action, reason = '', note = '' } = req.body;
  const updated = await svc.reviewLead({ lead, reviewer: req.user, action, reason, note });
  await recomputeTrustScore(lead.agent_id); // keep trust score live
  res.json({ lead: updated });
}));

router.post('/bulk', asyncHandler(async (req, res) => {
  const { lead_ids, action, reason = '' } = req.body;
  const results = await svc.bulkReview({ leadIds: lead_ids, reviewer: req.user, action, reason });
  res.json(results);
}));

router.post('/:id/super-lead', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  const updated = await svc.markSuperLead({ lead, user: req.user });
  await recomputeTrustScore(lead.agent_id);
  res.json({ lead: updated });
}));

router.get('/disputes', asyncHandler(async (req, res) => {
  const { rows, total, page } = await svc.listLeads({ filters: { dispute: 'true', ...req.query }, page: req.query.page, limit: req.query.limit || 20 });
  res.json({ rows, total, page });
}));

router.post('/dispute/:id/resolve', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  const { action, reason = '' } = req.body;
  const updated = await svc.resolveDispute({ lead, user: req.user, action, reason });
  await recomputeTrustScore(lead.agent_id);
  res.json({ lead: updated });
}));

export default router;