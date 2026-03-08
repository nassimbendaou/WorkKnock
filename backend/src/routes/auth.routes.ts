import { Router, Request, Response } from 'express';
import passport from 'passport';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { config } from '../config';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/password', authenticate, authController.updatePassword);
router.put('/settings', authenticate, authController.updateSettings);

// Google SSO (only if credentials are configured)
if (config.google.clientId && config.google.clientSecret) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
  router.get('/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
    authController.googleCallback
  );
} else {
  router.get('/google', (_req: Request, res: Response) =>
    res.status(501).json({ message: 'SSO Google non configuré. Ajoutez GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET.' }));
}

// Microsoft SSO (only if credentials are configured)
if (config.microsoft.clientId && config.microsoft.clientSecret) {
  router.get('/microsoft', passport.authenticate('microsoft', { scope: ['openid', 'profile', 'email'] }));
  router.get('/microsoft/callback',
    passport.authenticate('microsoft', { session: false, failureRedirect: '/auth/error' }),
    authController.microsoftCallback
  );
} else {
  router.get('/microsoft', (_req: Request, res: Response) =>
    res.status(501).json({ message: 'SSO Microsoft non configuré. Ajoutez MICROSOFT_CLIENT_ID et MICROSOFT_CLIENT_SECRET.' }));
}

export default router;
