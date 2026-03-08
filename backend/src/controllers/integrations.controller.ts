import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { config as appConfig } from '../config';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';

export const getIntegrations = async (req: Request, res: Response) => {
  const integrations = await prisma.integration.findMany({
    where: { userId: req.user!.id },
  });
  res.json(integrations);
};

// ── Bot info (phone numbers, links for QR codes) ──
export const getBotInfo = async (_req: Request, res: Response) => {
  res.json({
    whatsapp: {
      botPhone: appConfig.whatsapp.botPhone,
      configured: !!(appConfig.whatsapp.instanceId && appConfig.whatsapp.apiToken),
    },
    telegram: {
      botToken: !!appConfig.telegram.botToken,
      configured: !!appConfig.telegram.botToken,
    },
    slack: { configured: !!appConfig.slack.botToken },
    teams: { configured: !!appConfig.teams.appId },
  });
};

// ── Connect WhatsApp (scan & go) ──
export const connectWhatsApp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'Numéro de téléphone requis' });

  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 8) return res.status(400).json({ message: 'Numéro invalide' });

  // Check if this phone is already used by another user
  const existingUser = await prisma.user.findUnique({
    where: { phone: cleanPhone },
  });
  if (existingUser && existingUser.id !== req.user!.id) {
    return res.status(409).json({ message: 'Ce numéro est déjà associé à un autre compte' });
  }

  // Update user phone number
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { phone: cleanPhone },
  });

  const integration = await prisma.integration.upsert({
    where: { userId_type: { userId: req.user!.id, type: 'WHATSAPP' } },
    create: {
      userId: req.user!.id,
      type: 'WHATSAPP',
      config: { phone: cleanPhone },
      enabled: true,
    },
    update: {
      config: { phone: cleanPhone },
      enabled: true,
      updatedAt: new Date(),
    },
  });

  // Send welcome message immediately
  WhatsAppIntegration.sendMessage(cleanPhone, `🎉 *WorkKnock connecté, ${user?.name} !*\n\nVotre assistant IA est prêt. Envoyez-moi un message pour commencer !\n\n💡 Exemples:\n• "Crée une facture pour Dupont de 500€"\n• "Mes factures impayées ?"\n• "Ajoute un client Martin"\n• "Mon CA cette année ?"\n\nJe comprends le langage naturel 🤖`).catch(err => {
    console.error('[WhatsApp] Welcome msg error:', err.message);
  });

  res.json(integration);
};

// ── Connect Telegram ──
export const connectTelegram = async (req: Request, res: Response) => {
  const { chatId } = req.body;
  if (!chatId) return res.status(400).json({ message: 'Chat ID requis' });

  const integration = await prisma.integration.upsert({
    where: { userId_type: { userId: req.user!.id, type: 'TELEGRAM' } },
    create: { userId: req.user!.id, type: 'TELEGRAM', config: { chatId }, enabled: true },
    update: { config: { chatId }, enabled: true, updatedAt: new Date() },
  });
  res.json(integration);
};

export const upsertIntegration = async (req: Request, res: Response) => {
  const { type } = req.params;
  const { config, enabled, webhookUrl } = req.body;

  const integration = await prisma.integration.upsert({
    where: { userId_type: { userId: req.user!.id, type: type as any } },
    create: { userId: req.user!.id, type: type as any, config, enabled: enabled ?? true, webhookUrl },
    update: { config, enabled, webhookUrl, updatedAt: new Date() },
  });
  res.json(integration);
};

export const toggleIntegration = async (req: Request, res: Response) => {
  const { type } = req.params;
  const integration = await prisma.integration.findUnique({
    where: { userId_type: { userId: req.user!.id, type: type as any } },
  });
  if (!integration) return res.status(404).json({ message: 'Intégration non trouvée' });

  const updated = await prisma.integration.update({
    where: { userId_type: { userId: req.user!.id, type: type as any } },
    data: { enabled: !integration.enabled },
  });
  res.json(updated);
};

export const deleteIntegration = async (req: Request, res: Response) => {
  const { type } = req.params;
  await prisma.integration.deleteMany({
    where: { userId: req.user!.id, type: type as any },
  });
  res.status(204).send();
};

export const getNotifications = async (req: Request, res: Response) => {
  const { unread } = req.query;
  const where: any = { userId: req.user!.id };
  if (unread === 'true') where.read = false;

  const notifications = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, read: false } });
  res.json({ notifications, unreadCount });
};

export const markNotificationsRead = async (req: Request, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ message: 'Notifications marquées comme lues' });
};
