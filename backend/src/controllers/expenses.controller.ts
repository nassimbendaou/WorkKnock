import { Response } from 'express';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { PdfService } from '../services/pdf.service';

export const getExpenseReports = async (req: AuthRequest, res: Response) => {
  const { status, year, page = '1', limit = '20' } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const where: any = { userId: req.user!.id };
  if (status) where.status = status;
  if (year) where.year = parseInt(year as string);

  const [reports, total] = await Promise.all([
    prisma.expenseReport.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: { items: true },
    }),
    prisma.expenseReport.count({ where }),
  ]);
  res.json({ reports, total });
};

export const getExpenseReport = async (req: AuthRequest, res: Response) => {
  const report = await prisma.expenseReport.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { items: { orderBy: { date: 'asc' } }, user: { include: { settings: true } } },
  });
  if (!report) return res.status(404).json({ message: 'Note de frais non trouvée' });
  res.json(report);
};

export const createExpenseReport = async (req: AuthRequest, res: Response) => {
  const { title, month, year, items, notes } = req.body;
  const total = items?.reduce((sum: number, i: any) => sum + i.amount, 0) || 0;

  const report = await prisma.expenseReport.create({
    data: {
      userId: req.user!.id, title, month: parseInt(month), year: parseInt(year),
      total, notes,
      items: {
        create: items?.map((item: any) => ({
          date: new Date(item.date),
          category: item.category,
          description: item.description,
          amount: item.amount,
          vatAmount: item.vatAmount,
          receiptUrl: item.receiptUrl,
          isReimbursable: item.isReimbursable ?? true,
          merchant: item.merchant,
        })) || [],
      },
    },
    include: { items: true },
  });
  res.status(201).json(report);
};

export const updateExpenseReport = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.expenseReport.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Note de frais non trouvée' });
  if (exists.status === 'APPROVED') return res.status(400).json({ message: 'Une note de frais approuvée ne peut pas être modifiée' });

  const { items, ...rest } = req.body;
  const total = items?.reduce((sum: number, i: any) => sum + i.amount, 0) || exists.total;

  if (items) {
    await prisma.expenseItem.deleteMany({ where: { expenseReportId: req.params.id } });
    await prisma.expenseItem.createMany({
      data: items.map((item: any) => ({
        expenseReportId: req.params.id,
        date: new Date(item.date),
        category: item.category,
        description: item.description,
        amount: item.amount,
        vatAmount: item.vatAmount,
        receiptUrl: item.receiptUrl,
        isReimbursable: item.isReimbursable ?? true,
        merchant: item.merchant,
      })),
    });
  }

  const report = await prisma.expenseReport.update({
    where: { id: req.params.id },
    data: { ...rest, total },
    include: { items: true },
  });
  res.json(report);
};

export const deleteExpenseReport = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.expenseReport.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Note de frais non trouvée' });
  await prisma.expenseReport.delete({ where: { id: req.params.id } });
  res.status(204).send();
};

export const submitExpenseReport = async (req: AuthRequest, res: Response) => {
  const exists = await prisma.expenseReport.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Note de frais non trouvée' });

  const report = await prisma.expenseReport.update({
    where: { id: req.params.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
    include: { items: true },
  });
  res.json(report);
};

export const downloadExpenseReport = async (req: AuthRequest, res: Response) => {
  const report = await prisma.expenseReport.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { items: true, user: { include: { settings: true } } },
  });
  if (!report) return res.status(404).json({ message: 'Note de frais non trouvée' });

  const pdfBuffer = await PdfService.generateExpenseReport(report);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="note-frais-${report.month}-${report.year}.pdf"`);
  res.send(pdfBuffer);
};
