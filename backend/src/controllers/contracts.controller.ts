import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const getContracts = async (req: Request, res: Response) => {
  const { search, status, clientId, type, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: any = { userId: req.user!.id };
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (type) where.type = type;
  if (search) where.title = { contains: search as string };

  const [contracts, total] = await Promise.all([
    prisma.contract.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, name: true } } },
    }),
    prisma.contract.count({ where }),
  ]);

  res.json({ contracts, total, page: parseInt(page as string) });
};

export const getContract = async (req: Request, res: Response) => {
  const contract = await prisma.contract.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { client: true },
  });
  if (!contract) return res.status(404).json({ message: 'Contrat non trouvé' });
  res.json(contract);
};

export const createContract = async (req: Request, res: Response) => {
  const contract = await prisma.contract.create({
    data: {
      ...req.body,
      userId: req.user!.id,
      startDate: new Date(req.body.startDate),
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      signedAt: req.body.signedAt ? new Date(req.body.signedAt) : null,
    },
    include: { client: { select: { id: true, name: true } } },
  });
  res.status(201).json(contract);
};

export const updateContract = async (req: Request, res: Response) => {
  const exists = await prisma.contract.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Contrat non trouvé' });

  const contract = await prisma.contract.update({
    where: { id: req.params.id },
    data: {
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : null,
      signedAt: req.body.signedAt ? new Date(req.body.signedAt) : null,
    },
    include: { client: { select: { id: true, name: true } } },
  });
  res.json(contract);
};

export const deleteContract = async (req: Request, res: Response) => {
  const exists = await prisma.contract.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Contrat non trouvé' });

  await prisma.contract.delete({ where: { id: req.params.id } });
  res.status(204).send();
};

export const getIntercontract = async (req: Request, res: Response) => {
  // Find gaps between contracts (inter-contract periods)
  const contracts = await prisma.contract.findMany({
    where: { userId: req.user!.id, status: { in: ['COMPLETED', 'TERMINATED', 'ACTIVE'] } },
    orderBy: { startDate: 'asc' },
    include: { client: { select: { id: true, name: true } } },
  });

  const intercontracts = [];
  for (let i = 0; i < contracts.length - 1; i++) {
    const current = contracts[i];
    const next = contracts[i + 1];
    const endDate = current.endDate || current.startDate;
    const startNext = next.startDate;

    if (startNext > endDate) {
      const diffDays = Math.ceil((startNext.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        intercontracts.push({
          startDate: endDate,
          endDate: startNext,
          days: diffDays,
          previousContract: current,
          nextContract: next,
        });
      }
    }
  }

  res.json(intercontracts);
};
