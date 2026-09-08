import { Router } from 'express';
import * as svc from '../services/leadService.js';
import { requireAuth, requireActive } from '../middleware/auth.js';
import { leadSubmissionLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/error.js';
import { enqueueValidation } from '../jobs/queue.js';

const router = Router();
router.use(requireAuth, requireActive);
// review-capable roles get agent-level data too
router.use((req, res, next) => {
  req.access = req.user.role === 'lead_agent' ? 'own' : 'staff';
  next();
});

/**
 * Real-time duplicate check used by the submission form while typing.
 * Pass `exclude=<leadId>` when editing so the lead itself is not flagged.
 */
router.get('/check-duplicate', asyncHandler(async (req, res) => {
  const email = req.query.email || '';
  const whatsapp = req.query.whatsapp || '';
  if (!email && !whatsapp) return res.json({ email_taken: false, whatsapp_taken: false, duplicate: null });
  const { normalizeEmail, normalizePhone } = await import('../utils/helpers.js');
  const nEmail = normalizeEmail(email);
  const nPhone = normalizePhone(whatsapp);
  const dup = await svc.duplicateCheck({ email, whatsapp_number: whatsapp, excludeLeadId: req.query.exclude || null });
  const dupPhoneDigits = dup ? String(dup.whatsapp_number).replace(/\D/g, '') : null;
  const dupEmail = dup ? dup.email.toLowerCase() : null;
  res.json({
    email_taken: !!dup && (nEmail ? dupEmail === nEmail : false),
    whatsapp_taken: !!dup && (nPhone ? dupPhoneDigits === nPhone.replace(/\D/g, '') : false),
    duplicate: dup ? { id: dup.id, client_name: dup.client_name, agent_id: dup.agent_id, same_agent: dup.agent_id === req.user.id } : null,
  });
}));

router.post('/', leadSubmissionLimiter, asyncHandler(async (req, res) => {
  const { lead, fraud_flags } = await svc.createLead({ agent: req.user, body: req.body, ip: req.ip });
  // Fire-and-forget background auto-validation (non-blocking).
  enqueueValidation(lead.id).catch((e) => console.error('[routes] enqueue failed:', e.message));
  res.status(201).json({ lead, fraud_flags, queued_for_validation: true });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { rows, total, page } = await svc.listLeads({
    filters: req.query,
    page: req.query.page,
    limit: req.query.limit || 15,
    userId: req.user.id,
    role: req.user.role,
  });
  res.json({ rows, total, page });
}));

router.get('/counts', asyncHandler(async (req, res) => {
  const rows = await svc.leadCountsByStatus(req.user.id);
  const counts = { pending: 0, under_review: 0, approved: 0, rejected: 0, needs_info: 0 };
  for (const r of rows) counts[r.status] = r.n;
  const total = rows.reduce((a, r) => a + r.n, 0);
  res.json({ ...counts, total });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  if (req.user.role === 'lead_agent' && lead.agent_id !== req.user.id) {
    return res.status(403).json({ message: 'You can only view your own leads.' });
  }
  res.json({ lead });
}));

/** Agent files a dispute/re-review request on a rejected lead. */
router.post('/:id/dispute', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  await svc.requestDispute({ lead, agent: req.user, note: req.body.note });
  res.json({ success: true, message: 'Dispute filed. A moderator will re-review this lead.' });
}));

/** Edit a lead (agents: own open leads; staff: any lead anytime). */
router.put('/:id', asyncHandler(async (req, res) => {
  const lead = await svc.getLeadForReview(req.params.id);
  if (!lead) return res.status(404).json({ message: 'Lead not found.' });
  const updated = await svc.editLead({ lead, editor: req.user, body: req.body, note: req.body.note });
  if (updated.status === 'pending') {
    enqueueValidation(updated.id).catch((e) => console.error('[routes] enqueue failed:', e.message));
  }
  res.json({ lead: updated });
}));

export default router;