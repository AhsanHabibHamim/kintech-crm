import { Router } from 'express';
import { body } from 'express-validator';
import * as auth from '../services/authService.js';
import { requireAuth, require2fa } from '../middleware/auth.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../middleware/error.js';
import { audit } from '../services/auditService.js';

const router = Router();

router.post(
  '/register',
  registerLimiter,
  asyncHandler(async (req, res) => {
    const user = await auth.registerAgent({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      password: req.body.password,
      referral: req.body.referral,
      termsAccepted: req.body.terms_accepted === true || req.body.terms_accepted === 'true',
    });
    // Track the signup for the approval queue.
    await audit({ user_id: user.id, action: 'agent_signup', target_type: 'user', target_id: user.id, details: { pending: true }, ip: req.ip });
    res.status(201).json({ message: 'Account created. An administrator will approve it before you can submit leads.', user });
  }),
);

router.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const result = await auth.login(req.body);
    await audit({ user_id: result.user?.id || null, action: 'login', target_type: 'user', target_id: result.user?.id || null, details: { require_2fa: !!result.require_2fa }, ip: req.ip });
    res.json(result);
  }),
);

router.post('/2fa/verify', asyncHandler(async (req, res) => {
  const result = await auth.verify2fa({ temp_token: req.body.temp_token, code: req.body.code });
  res.json(result);
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.body.refresh_token || req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ message: 'Missing refresh token.' });
  const result = await auth.refreshTokens(token);
  res.json(result);
}));

router.post('/logout', requireAuth, asyncHandler(async (req, res) => {
  await audit({ user_id: req.user.id, action: 'logout', target_type: 'user', target_id: req.user.id, ip: req.ip });
  res.json({ message: 'Logged out.' });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const fresh = await auth.findUserById(req.user.id);
  res.json({ user: fresh });
}));

// ---- 2FA enrollment (admin & managers — enforced at dashboard by require2fa middleware) ----
router.post('/2fa/setup', requireAuth, asyncHandler(async (req, res) => {
  const setup = await auth.generateTotpSetup(req.user);
  res.json(setup);
}));

router.post('/2fa/enable', requireAuth, asyncHandler(async (req, res) => {
  await auth.enable2fa(req.user, req.body.code);
  await audit({ user_id: req.user.id, action: '2fa_enabled', target_type: 'user', target_id: req.user.id });
  res.json({ success: true });
}));

router.post('/2fa/disable', requireAuth, asyncHandler(async (req, res) => {
  await auth.disable2fa(req.user, req.body.code);
  await audit({ user_id: req.user.id, action: '2fa_disabled', target_type: 'user', target_id: req.user.id });
  res.json({ success: true });
}));

export default router;