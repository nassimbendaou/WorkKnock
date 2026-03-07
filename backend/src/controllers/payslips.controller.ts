import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { PdfService } from '../services/pdf.service';

// French social charges rates (simplified)
const URSSAF_RATE = 0.22; // ~22% for micro-entrepreneur
const CSG_CRDS_RATE = 0.097;
const RETIREMENT_RATE = 0.068;

export const getPaySlips = async (req: AuthRequest, res: Response) => {
  const { year, page = '1', limit = '20' } = req.query;
  const where: any = { userId: req.user!.id };
  if (year) where.year = parseInt(year as string);

  const [paySlips, total] = await Promise.all([
    prisma.paySlip.findMany({
      where, skip: (parseInt(page as string) - 1) * parseInt(limit as string),
      take: parseInt(limit as string),
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    }),
    prisma.paySlip.count({ where }),
  ]);
  res.json({ paySlips, total });
};

export const getPaySlip = async (req: AuthRequest, res: Response) => {
  const paySlip = await prisma.paySlip.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { user: { include: { settings: true } } },
  });
  if (!paySlip) return res.status(404).json({ message: 'Fiche de paie non trouvée' });
  res.json(paySlip);
};

export const generatePaySlip = async (req: AuthRequest, res: Response) => {
  const { month, year, grossAmount, notes } = req.body;

  // Check if already exists
  const existing = await prisma.paySlip.findUnique({
    where: { userId_month_year: { userId: req.user!.id, month: parseInt(month), year: parseInt(year) } },
  });
  if (existing) return res.status(409).json({ message: 'Une fiche de paie existe déjà pour ce mois' });

  const gross = parseFloat(grossAmount);
  const urssafAmount = gross * URSSAF_RATE;
  const csgAmount = gross * CSG_CRDS_RATE;
  const retirementAmount = gross * RETIREMENT_RATE;
  const socialCharges = urssafAmount + csgAmount + retirementAmount;
  const netAmount = gross - socialCharges;

  const paySlip = await prisma.paySlip.create({
    data: {
      userId: req.user!.id,
      month: parseInt(month),
      year: parseInt(year),
      grossAmount: gross,
      netAmount,
      socialCharges,
      urssafAmount,
      csgAmount,
      retirementAmount,
      status: 'GENERATED',
      notes,
    },
  });
  res.status(201).json(paySlip);
};

export const updatePaySlip = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.paySlip.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Fiche de paie non trouvée' });

  const paySlip = await prisma.paySlip.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(paySlip);
};

export const downloadPaySlip = async (req: AuthRequest, res: Response) => {
  const paySlip = await prisma.paySlip.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { user: { include: { settings: true } } },
  });
  if (!paySlip) return res.status(404).json({ message: 'Fiche de paie non trouvée' });

  const pdfBuffer = await PdfService.generatePaySlip(paySlip);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="bulletin-paie-${paySlip.month}-${paySlip.year}.pdf"`);
  res.send(pdfBuffer);
};
