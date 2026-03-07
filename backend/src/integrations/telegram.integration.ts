import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '../utils/prisma';
import { PdfService } from '../services/pdf.service';
import { config } from '../config';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

let botInstance: TelegramBot | null = null;

export class TelegramIntegration {
  static getBot(): TelegramBot | null {
    if (!config.telegram.botToken) return null;
    if (!botInstance) {
      botInstance = new TelegramBot(config.telegram.botToken, { polling: false });
    }
    return botInstance;
  }

  static async sendMessage(chatId: string | number, text: string) {
    const bot = TelegramIntegration.getBot();
    if (!bot) return;
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }

  static async sendDocument(chatId: string | number, buffer: Buffer, filename: string, caption: string) {
    const bot = TelegramIntegration.getBot();
    if (!bot) return;
    await bot.sendDocument(chatId, buffer, { caption }, { filename, contentType: 'application/pdf' });
  }

  static async handleWebhook(body: any, userId: string) {
    const message = body?.message;
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text = message.text.toLowerCase().trim();
    const cmd = text.split(' ');
    const command = cmd[0];

    const integration = await prisma.integration.findFirst({
      where: { userId, type: 'TELEGRAM', enabled: true },
    });
    if (!integration) return;

    try {
      if (command === '/start' || command === '/aide') {
        await TelegramIntegration.sendMessage(chatId, `
🤖 *WorkKnock Bot*

Commandes disponibles:
📄 /factures - Vos factures
📊 /ca - Chiffre d'affaires
💸 /impayes - Factures impayées
🧾 /frais - Notes de frais
🏖️ /conges - Solde congés
👤 /clients - Vos clients
        `);
        return;
      }

      if (command === '/factures') {
        const clientSearch = cmd.slice(1).join(' ');
        const where: any = { userId };
        if (clientSearch) where.client = { name: { contains: clientSearch } };

        const invoices = await prisma.invoice.findMany({
          where, include: { client: { select: { name: true } } },
          orderBy: { issueDate: 'desc' }, take: 10,
        });

        if (!invoices.length) {
          await TelegramIntegration.sendMessage(chatId, '❌ Aucune facture trouvée.');
          return;
        }

        const statusEmoji: any = { PAID: '✅', SENT: '📤', OVERDUE: '🔴', DRAFT: '📝' };
        let msg = `📄 *${invoices.length} facture(s):*\n\n`;
        for (const inv of invoices) {
          msg += `${statusEmoji[inv.status]} *${inv.number}* - ${inv.client.name}\n`;
          msg += `💰 ${fmt(inv.total)} | 📅 ${new Date(inv.dueDate).toLocaleDateString('fr-FR')}\n\n`;
        }
        await TelegramIntegration.sendMessage(chatId, msg);
        return;
      }

      if (command === '/facture') {
        const number = cmd[1];
        if (!number) { await TelegramIntegration.sendMessage(chatId, 'Usage: /facture [numéro]'); return; }

        const invoice = await prisma.invoice.findFirst({
          where: { userId, number: { contains: number } },
          include: { client: true, items: true, user: { include: { settings: true } } },
        });

        if (!invoice) { await TelegramIntegration.sendMessage(chatId, '❌ Facture non trouvée.'); return; }

        const pdf = await PdfService.generateInvoice(invoice);
        await TelegramIntegration.sendDocument(chatId, pdf, `facture-${invoice.number}.pdf`, `Facture ${invoice.number} - ${fmt(invoice.total)}`);
        return;
      }

      if (command === '/ca') {
        const year = cmd[1] ? parseInt(cmd[1]) : new Date().getFullYear();
        const revenue = await prisma.invoice.aggregate({
          where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
          _sum: { total: true }, _count: true,
        });
        await TelegramIntegration.sendMessage(chatId,
          `📊 *CA ${year}:* ${fmt(revenue._sum.total || 0)}\n📄 ${revenue._count} facture(s) payée(s)`);
        return;
      }

      if (command === '/impayes') {
        const invoices = await prisma.invoice.findMany({
          where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
          include: { client: { select: { name: true } } },
        });
        if (!invoices.length) { await TelegramIntegration.sendMessage(chatId, '✅ Aucune facture impayée !'); return; }
        const total = invoices.reduce((s, i) => s + i.total, 0);
        let msg = `💸 *${invoices.length} impayé(s) - ${fmt(total)}:*\n\n`;
        for (const inv of invoices) msg += `🔴 ${inv.number} - ${inv.client.name} - ${fmt(inv.total)}\n`;
        await TelegramIntegration.sendMessage(chatId, msg);
        return;
      }

      if (command === '/conges') {
        const year = new Date().getFullYear();
        const settings = await prisma.userSettings.findUnique({ where: { userId } });
        const approved = await prisma.leave.findMany({
          where: { userId, status: 'APPROVED', startDate: { gte: new Date(`${year}-01-01`) } },
        });
        const usedCP = approved.filter(l => l.type === 'CP').reduce((s, l) => s + l.days, 0);
        const cpTotal = settings?.cpPerYear || 25;
        await TelegramIntegration.sendMessage(chatId, `🏖️ *Congés ${year}:*\nCP restants: ${cpTotal - usedCP}/${cpTotal} jours`);
        return;
      }

      if (command === '/clients') {
        const clients = await prisma.client.findMany({ where: { userId, status: 'ACTIVE' }, take: 10 });
        let msg = `👤 *${clients.length} client(s):*\n\n`;
        for (const c of clients) msg += `• ${c.name}\n`;
        await TelegramIntegration.sendMessage(chatId, msg);
        return;
      }

      await TelegramIntegration.sendMessage(chatId, '❓ Commande inconnue. Tapez /aide');
    } catch (err) {
      console.error('[Telegram] Error:', err);
    }
  }
}
