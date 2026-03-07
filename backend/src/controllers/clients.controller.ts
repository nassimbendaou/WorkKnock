import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';

export const getClients = async (req: AuthRequest, res: Response) => {
  const { search, status, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: any = { userId: req.user!.id };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search as string } },
      { email: { contains: search as string } },
      { contactName: { contains: search as string } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { invoices: true, contracts: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  res.json({ clients, total, page: parseInt(page as string), limit: parseInt(limit as string) });
};

export const getClient = async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: {
      contracts: { orderBy: { startDate: 'desc' } },
      invoices: {
        orderBy: { issueDate: 'desc' },
        take: 10,
      },
      _count: { select: { invoices: true, contracts: true } },
    },
  });
  if (!client) return res.status(404).json({ message: 'Client non trouvé' });

  // Calculate revenue from this client
  const invoiceStats = await prisma.invoice.aggregate({
    where: { clientId: req.params.id, userId: req.user!.id, status: { in: ['PAID', 'SENT'] } },
    _sum: { total: true },
  });

  res.json({ ...client, totalRevenue: invoiceStats._sum.total || 0 });
};

export const createClient = async (req: AuthRequest, res: Response) => {
  const client = await prisma.client.create({
    data: { ...req.body, userId: req.user!.id },
  });
  res.status(201).json(client);
};

export const updateClient = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.client.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Client non trouvé' });

  const client = await prisma.client.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(client);
};

export const deleteClient = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.client.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Client non trouvé' });

  await prisma.client.delete({ where: { id: req.params.id } });
  res.status(204).send();
};
