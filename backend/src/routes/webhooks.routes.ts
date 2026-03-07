import { Router, Request, Response } from 'express';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';
import { TelegramIntegration } from '../integrations/telegram.integration';
import { SlackIntegration } from '../integrations/slack.integration';
import { TeamsIntegration } from '../integrations/teams.integration';
import { prisma } from '../utils/prisma';

const router = Router();

// Resolve userId from webhook token in query param
const resolveUser = async (req: Request): Promise<string | null> => {
  const token = req.query.token as string;
  if (!token) return null;
  const integration = await prisma.integration.findFirst({
    where: { webhookUrl: { contains: token } },
    select: { userId: true },
  });
  return integration?.userId || null;
};

router.post('/whatsapp/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  res.status(200).json({ status: 'ok' }); // Respond quickly
  WhatsAppIntegration.handleWebhook(req.body, userId).catch(console.error);
});

router.post('/telegram/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  res.status(200).json({ status: 'ok' });
  TelegramIntegration.handleWebhook(req.body, userId).catch(console.error);
});

router.post('/slack/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  // Slack requires synchronous response
  const response = await SlackIntegration.handleSlashCommand(req.body, userId);
  res.status(200).json(response);
});

router.post('/teams/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const response = await TeamsIntegration.handleWebhook(req.body, userId);
  res.status(200).json(response);
});

export default router;
