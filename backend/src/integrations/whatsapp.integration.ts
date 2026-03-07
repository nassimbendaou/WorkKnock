import axios from 'axios';
import { prisma } from '../utils/prisma';
import { PdfService } from '../services/pdf.service';
import { config } from '../config';

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export class WhatsAppIntegration {
  static async sendMessage(phone: string, message: string, instanceId?: string, token?: string) {
    const id = instanceId || config.whatsapp.instanceId;
    const tk = token || config.whatsapp.apiToken;
    if (!id || !tk) return;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;

    await axios.post(`${config.whatsapp.apiUrl}/waInstance${id}/sendMessage/${tk}`, {
      chatId, message,
    });
  }

  static async sendFile(phone: string, fileBuffer: Buffer, filename: string, caption: string, instanceId?: string, token?: string) {
    const id = instanceId || config.whatsapp.instanceId;
    const tk = token || config.whatsapp.apiToken;
    if (!id || !tk) return;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;
    const base64 = fileBuffer.toString('base64');

    await axios.post(`${config.whatsapp.apiUrl}/waInstance${id}/sendFileByUpload/${tk}`, {
      chatId,
      fileName: filename,
      file: base64,
      caption,
    });
  }

  static async handleWebhook(body: any, userId: string) {
    const messageData = body?.body;
    if (!messageData || messageData.typeWebhook !== 'incomingMessageReceived') return;

    const senderPhone = messageData.senderData?.chatId?.replace('@c.us', '');
    const text = messageData.messageData?.textMessageData?.textMessage?.toLowerCase()?.trim();
    if (!text) return;

    const integration = await prisma.integration.findFirst({
      where: { userId, type: 'WHATSAPP', enabled: true },
    });
    if (!integration) return;

    const intConfig = integration.config as any;
    const instanceId = intConfig.instanceId;
    const token = intConfig.apiToken;

    const cmd = text.split(' ');
    const command = cmd[0];

    try {
      if (command === '/aide' || command === '/help') {
        await WhatsAppIntegration.sendMessage(senderPhone, `
🤖 *WorkKnock Bot - Commandes disponibles:*

📄 */factures* - Liste de toutes vos factures
📄 */factures [client]* - Factures d'un client
📋 */facture [numéro]* - Détails d'une facture
📊 */ca* - Chiffre d'affaires de l'année
📊 */ca [année]* - CA d'une année spécifique
💸 */impayes* - Factures non payées
🧾 */frais* - Notes de frais du mois
🏖️ */conges* - Solde de congés
📌 */clients* - Liste des clients
`, instanceId, token);
        return;
      }

      if (command === '/factures' || command === '/facture') {
        const searchTerm = cmd.slice(1).join(' ');
        const where: any = { userId };
        if (searchTerm && command === '/factures') {
          where.client = { name: { contains: searchTerm } };
        }
        if (searchTerm && command === '/facture') {
          where.number = { contains: searchTerm };
        }

        const invoices = await prisma.invoice.findMany({
          where,
          include: { client: { select: { name: true } } },
          orderBy: { issueDate: 'desc' },
          take: 10,
        });

        if (!invoices.length) {
          await WhatsAppIntegration.sendMessage(senderPhone, '❌ Aucune facture trouvée.', instanceId, token);
          return;
        }

        const statusEmoji: any = { PAID: '✅', SENT: '📤', OVERDUE: '🔴', DRAFT: '📝', CANCELLED: '❌' };
        let msg = `📄 *${invoices.length} facture(s):*\n\n`;
        for (const inv of invoices) {
          msg += `${statusEmoji[inv.status]} *${inv.number}*\n`;
          msg += `👤 ${inv.client.name}\n`;
          msg += `💰 ${fmt(inv.total)}\n`;
          msg += `📅 ${new Date(inv.dueDate).toLocaleDateString('fr-FR')}\n\n`;
        }

        await WhatsAppIntegration.sendMessage(senderPhone, msg, instanceId, token);

        // If single invoice, send PDF
        if (invoices.length === 1 && command === '/facture') {
          const invoice = await prisma.invoice.findFirst({
            where: { id: invoices[0].id },
            include: { client: true, items: true, user: { include: { settings: true } } },
          });
          if (invoice) {
            const pdf = await PdfService.generateInvoice(invoice);
            await WhatsAppIntegration.sendFile(senderPhone, pdf, `facture-${invoice.number}.pdf`, `Facture ${invoice.number}`, instanceId, token);
          }
        }
        return;
      }

      if (command === '/ca') {
        const year = cmd[1] ? parseInt(cmd[1]) : new Date().getFullYear();
        const revenue = await prisma.invoice.aggregate({
          where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
          _sum: { total: true },
          _count: true,
        });
        const expenses = await prisma.expenseReport.aggregate({
          where: { userId, year },
          _sum: { total: true },
        });
        const msg = `📊 *Chiffre d'affaires ${year}:*\n\n💰 CA: ${fmt(revenue._sum.total || 0)}\n🧾 Frais: ${fmt(expenses._sum.total || 0)}\n📈 Net estimé: ${fmt((revenue._sum.total || 0) - (expenses._sum.total || 0))}\n📄 ${revenue._count} facture(s) payée(s)`;
        await WhatsAppIntegration.sendMessage(senderPhone, msg, instanceId, token);
        return;
      }

      if (command === '/impayes') {
        const invoices = await prisma.invoice.findMany({
          where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
          include: { client: { select: { name: true } } },
          orderBy: { dueDate: 'asc' },
        });
        if (!invoices.length) {
          await WhatsAppIntegration.sendMessage(senderPhone, '✅ Aucune facture impayée !', instanceId, token);
          return;
        }
        const total = invoices.reduce((s, i) => s + i.total, 0);
        let msg = `💸 *${invoices.length} facture(s) impayée(s) - ${fmt(total)}:*\n\n`;
        for (const inv of invoices) {
          const overdue = inv.status === 'OVERDUE';
          const days = Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
          msg += `${overdue ? '🔴' : '🟡'} *${inv.number}* - ${inv.client.name}\n`;
          msg += `💰 ${fmt(inv.total)} ${overdue ? `(${days}j de retard)` : ''}\n\n`;
        }
        await WhatsAppIntegration.sendMessage(senderPhone, msg, instanceId, token);
        return;
      }

      if (command === '/conges') {
        const year = new Date().getFullYear();
        const settings = await prisma.userSettings.findUnique({ where: { userId } });
        const approved = await prisma.leave.findMany({
          where: { userId, status: 'APPROVED', startDate: { gte: new Date(`${year}-01-01`) } },
        });
        const usedCP = approved.filter(l => l.type === 'CP').reduce((s, l) => s + l.days, 0);
        const usedRTT = approved.filter(l => l.type === 'RTT').reduce((s, l) => s + l.days, 0);
        const cpTotal = settings?.cpPerYear || 25;
        const rttTotal = settings?.rttPerYear || 0;
        const msg = `🏖️ *Solde de congés ${year}:*\n\n🌴 CP: ${cpTotal - usedCP}/${cpTotal} jours restants\n☀️ RTT: ${rttTotal - usedRTT}/${rttTotal} jours restants`;
        await WhatsAppIntegration.sendMessage(senderPhone, msg, instanceId, token);
        return;
      }

      if (command === '/clients') {
        const clients = await prisma.client.findMany({ where: { userId, status: 'ACTIVE' }, take: 10, orderBy: { name: 'asc' } });
        let msg = `👤 *${clients.length} client(s) actif(s):*\n\n`;
        for (const c of clients) msg += `• *${c.name}*${c.email ? ` - ${c.email}` : ''}\n`;
        await WhatsAppIntegration.sendMessage(senderPhone, msg, instanceId, token);
        return;
      }

      await WhatsAppIntegration.sendMessage(senderPhone,
        '❓ Commande inconnue. Tapez */aide* pour voir les commandes disponibles.', instanceId, token);
    } catch (err) {
      console.error('[WhatsApp] Error:', err);
    }
  }
}
