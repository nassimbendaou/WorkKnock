import { prisma } from './prisma';

export async function generateInvoiceNumber(userId: string): Promise<string> {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const prefix = settings?.invoicePrefix || 'FAC';
  const nextNumber = settings?.invoiceNextNumber || 1;
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(4, '0');

  // Increment next number
  await prisma.userSettings.update({
    where: { userId },
    data: { invoiceNextNumber: { increment: 1 } },
  });

  return `${prefix}-${year}-${padded}`;
}
