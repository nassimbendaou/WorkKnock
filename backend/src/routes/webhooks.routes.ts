import { Router, Request, Response } from 'express';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';
import { TelegramIntegration } from '../integrations/telegram.integration';
import { SlackIntegration } from '../integrations/slack.integration';
import { TeamsIntegration } from '../integrations/teams.integration';
import { prisma } from '../utils/prisma';

const router = Router();

// ── Global WhatsApp webhook (resolves user by phone number) ──
router.post('/whatsapp', async (req: Request, res: Response) => {
  console.log('[WEBHOOK] ✉️  Incoming WhatsApp webhook');
  console.log('[WEBHOOK] Raw body:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ status: 'ok' });
  WhatsAppIntegration.handleGlobalWebhook(req.body).catch(err => {
    console.error('[WEBHOOK] ❌ handleGlobalWebhook error:', err);
  });
});

// Keep legacy per-user webhook for backward compat
router.post('/whatsapp/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  res.status(200).json({ status: 'ok' });
  WhatsAppIntegration.handleWebhook(req.body, userId).catch(console.error);
});

router.post('/telegram/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  res.status(200).json({ status: 'ok' });
  TelegramIntegration.handleWebhook(req.body, userId).catch(console.error);
});

router.post('/slack/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const response = await SlackIntegration.handleSlashCommand(req.body, userId);
  res.status(200).json(response);
});

router.post('/teams/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const response = await TeamsIntegration.handleWebhook(req.body, userId);
  res.status(200).json(response);
});

export default router;
