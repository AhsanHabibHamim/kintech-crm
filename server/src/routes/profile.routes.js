import { Router } from 'express';
import * as users from '../services/userService.js';
import { requireAuth, requireActive } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';

const router = Router();
router.use(requireAuth, requireActive);

router.get('/me', asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

router.patch('/me', asyncHandler(async (req, res) => {
  const { name, phone, bkash_number, nagad_number } = req.body;
  const user = await users.updateOwnProfile(req.user, { name, phone, bkash_number, nagad_number });
  res.json({ user });
}));

router.post('/me/password', asyncHandler(async (req, res) => {
  await users.changeOwnPassword(req.user, { current_password: req.body.current_password, new_password: req.body.new_password });
  res.json({ message: 'Password changed. Please log in again.' });
}));

export default router;