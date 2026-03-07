import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getIntegrations = async (req: AuthRequest, res: Response) => {
  const integrations = await prisma.integration.findMany({
    where: { userId: req.user!.id },
  });
  res.json(integrations);
};

export const upsertIntegration = async (req: AuthRequest, res: Response) => {
  const { type } = req.params;
  const { config, enabled, webhookUrl } = req.body;

  const integration = await prisma.integration.upsert({
    where: { userId_type: { userId: req.user!.id, type: type as any } },
    create: { userId: req.user!.id, type: type as any, config, enabled: enabled ?? true, webhookUrl },
    update: { config, enabled, webhookUrl, updatedAt: new Date() },
  });
  res.json(integration);
};

export const toggleIntegration = async (req: AuthRequest, res: Response) => {
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

export const deleteIntegration = async (req: AuthRequest, res: Response) => {
  const { type } = req.params;
  await prisma.integration.deleteMany({
    where: { userId: req.user!.id, type: type as any },
  });
  res.status(204).send();
};

export const getNotifications = async (req: AuthRequest, res: Response) => {
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

export const markNotificationsRead = async (req: AuthRequest, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  });
  res.json({ message: 'Notifications marquées comme lues' });
};
