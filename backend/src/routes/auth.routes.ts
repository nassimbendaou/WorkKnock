import { Router } from 'express';
import passport from 'passport';
import * as authController from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);
router.put('/profile', authenticate, authController.updateProfile);
router.put('/password', authenticate, authController.updatePassword);
router.put('/settings', authenticate, authController.updateSettings);

// Google SSO
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/error' }),
  authController.googleCallback
);

// Microsoft SSO
router.get('/microsoft', passport.authenticate('microsoft', { scope: ['openid', 'profile', 'email'] }));
router.get('/microsoft/callback',
  passport.authenticate('microsoft', { session: false, failureRedirect: '/auth/error' }),
  authController.microsoftCallback
);

export default router;
