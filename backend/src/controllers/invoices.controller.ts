import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { PdfService } from '../services/pdf.service';
import { EmailService } from '../services/email.service';
import { NotificationService } from '../services/notification.service';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export const getInvoices = async (req: Request, res: Response) => {
  const { search, status, clientId, page = '1', limit = '20', year, month } = req.query;
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

  const where: any = { userId: req.user!.id };
  if (status) where.status = status;
  if (clientId) where.clientId = clientId;
  if (year) {
    where.issueDate = {
      gte: new Date(`${year}-01-01`),
      lte: new Date(`${year}-12-31`),
    };
  }
  if (month && year) {
    where.issueDate = {
      gte: new Date(`${year}-${month}-01`),
      lte: new Date(`${year}-${month}-31`),
    };
  }
  if (search) {
    where.OR = [
      { number: { contains: search as string } },
      { client: { name: { contains: search as string } } },
    ];
  }

  const [invoices, total, stats] = await Promise.all([
    prisma.invoice.findMany({
      where, skip, take: parseInt(limit as string),
      orderBy: { issueDate: 'desc' },
      include: {
        client: { select: { id: true, name: true, email: true } },
        items: true,
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoice.aggregate({
      where: { userId: req.user!.id },
      _sum: { total: true },
    }),
  ]);

  // Check & update overdue invoices
  const overdueResult = await prisma.invoice.updateMany({
    where: {
      userId: req.user!.id,
      status: 'SENT',
      dueDate: { lt: new Date() },
    },
    data: { status: 'OVERDUE' },
  });

  // Notify about newly overdue invoices
  if (overdueResult.count > 0) {
    NotificationService.create(req.user!.id, 'INVOICE_OVERDUE',
      `${overdueResult.count} facture(s) en retard`,
      `${overdueResult.count} facture(s) viennent de passer en retard de paiement`).catch(() => {});
  }

  res.json({ invoices, total, page: parseInt(page as string), totalRevenue: stats._sum.total || 0 });
};

export const getInvoice = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: {
      client: true,
      items: { orderBy: { order: 'asc' } },
      payments: { orderBy: { date: 'desc' } },
      user: { include: { settings: true } },
    },
  });
  if (!invoice) return res.status(404).json({ message: 'Facture non trouvée' });
  res.json(invoice);
};

export const createInvoice = async (req: Request, res: Response) => {
  const { clientId, items, taxRate, issueDate, dueDate, notes, paymentTerms } = req.body;
  const number = await generateInvoiceNumber(req.user!.id);

  const subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const invoice = await prisma.invoice.create({
    data: {
      userId: req.user!.id,
      clientId,
      number,
      taxRate,
      subtotal,
      taxAmount,
      total,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      notes,
      paymentTerms,
      items: {
        create: items.map((item: any, idx: number) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
          order: idx,
        })),
      },
    },
    include: {
      client: true,
      items: true,
    },
  });

  // Auto-notify: invoice created
  await NotificationService.create(req.user!.id, 'INVOICE_CREATED',
    `Facture ${number} créée`,
    `Facture de ${fmt(total)} pour ${invoice.client.name}`);

  res.status(201).json(invoice);
};

export const updateInvoice = async (req: Request, res: Response) => {
  const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Facture non trouvée' });
  if (exists.status === 'PAID') return res.status(400).json({ message: 'Une facture payée ne peut pas être modifiée' });

  const { items, taxRate, ...rest } = req.body;

  let subtotal = exists.subtotal;
  let taxAmount = exists.taxAmount;
  let total = exists.total;

  if (items) {
    subtotal = items.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0);
    taxAmount = subtotal * ((taxRate || exists.taxRate) / 100);
    total = subtotal + taxAmount;

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } });
    await prisma.invoiceItem.createMany({
      data: items.map((item: any, idx: number) => ({
        invoiceId: req.params.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: idx,
      })),
    });
  }

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: {
      ...rest,
      taxRate: taxRate || exists.taxRate,
      subtotal, taxAmount, total,
      issueDate: rest.issueDate ? new Date(rest.issueDate) : undefined,
      dueDate: rest.dueDate ? new Date(rest.dueDate) : undefined,
    },
    include: { client: true, items: true },
  });
  res.json(invoice);
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Facture non trouvée' });
  if (exists.status === 'PAID') return res.status(400).json({ message: 'Une facture payée ne peut pas être supprimée' });

  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.status(204).send();
};

export const sendInvoice = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { client: true, items: true, user: { include: { settings: true } } },
  });
  if (!invoice) return res.status(404).json({ message: 'Facture non trouvée' });

  try {
    // Generate PDF
    const pdfBuffer = await PdfService.generateInvoice(invoice);

    // Send email
    if (invoice.client.email) {
      await EmailService.sendInvoice(invoice, pdfBuffer);
    }

    const updated = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { status: 'SENT', sentAt: new Date() },
      include: { client: true, items: true },
    });

    await NotificationService.create(req.user!.id, 'INVOICE_SENT',
      `Facture ${invoice.number} envoyée`, `Facture envoyée à ${invoice.client.name}`);

    res.json({ message: 'Facture envoyée', invoice: updated });
  } catch (err: any) {
    res.status(500).json({ message: 'Erreur lors de l\'envoi', error: err.message });
  }
};

export const downloadInvoice = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { client: true, items: true, user: { include: { settings: true } } },
  });
  if (!invoice) return res.status(404).json({ message: 'Facture non trouvée' });

  const pdfBuffer = await PdfService.generateInvoice(invoice);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="facture-${invoice.number}.pdf"`);
  res.send(pdfBuffer);
};

export const markAsPaid = async (req: Request, res: Response) => {
  const { amount, date, method, reference } = req.body;
  const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!exists) return res.status(404).json({ message: 'Facture non trouvée' });

  await prisma.payment.create({
    data: { invoiceId: req.params.id, amount, date: new Date(date), method, reference },
  });

  const invoice = await prisma.invoice.update({
    where: { id: req.params.id },
    data: { status: 'PAID', paidAt: new Date(date) },
    include: { client: true, items: true },
  });

  await NotificationService.create(req.user!.id, 'INVOICE_PAID',
    `Facture ${exists.number} payée`, `Paiement de ${amount}€ reçu`);

  res.json(invoice);
};

export const sendReminder = async (req: Request, res: Response) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
    include: { client: true, items: true, user: { include: { settings: true } } },
  });
  if (!invoice) return res.status(404).json({ message: 'Facture non trouvée' });
  if (!['SENT', 'OVERDUE'].includes(invoice.status)) {
    return res.status(400).json({ message: 'La relance n\'est possible que pour les factures envoyées ou en retard' });
  }

  if (invoice.client.email) {
    const pdfBuffer = await PdfService.generateInvoice(invoice);
    await EmailService.sendReminder(invoice, pdfBuffer);
  }

  await prisma.invoice.update({
    where: { id: req.params.id },
    data: { reminderSentAt: new Date() },
  });

  res.json({ message: 'Relance envoyée' });
};

export const getUnpaidInvoices = async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId: req.user!.id,
      status: { in: ['SENT', 'OVERDUE'] },
    },
    include: { client: { select: { id: true, name: true, email: true } }, items: true },
    orderBy: { dueDate: 'asc' },
  });

  const totalUnpaid = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const overdue = invoices.filter(inv => inv.status === 'OVERDUE');
  const totalOverdue = overdue.reduce((sum, inv) => sum + inv.total, 0);

  res.json({ invoices, totalUnpaid, totalOverdue, overdueCount: overdue.length });
};
