import { Router } from 'express';
import * as notif from '../services/notificationService.js';
import { requireAuth, requireActive } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireActive);

router.get('/', asyncHandler(async (req, res) => {
  const result = await notif.listNotifications(req.user.id, {
    page: req.query.page,
    limit: req.query.limit || 25,
    unreadOnly: req.query.unread === 'true',
  });
  res.json(result);
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  await notif.markNotificationRead(req.user.id, Number(req.params.id));
  res.json({ success: true });
}));

router.post('/read-all', asyncHandler(async (req, res) => {
  await notif.markAllNotificationsRead(req.user.id);
  res.json({ success: true });
}));

export default router;