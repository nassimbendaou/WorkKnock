import { WebClient } from '@slack/web-api';
import { prisma } from '../utils/prisma';
import { config } from '../config';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export class SlackIntegration {
  static getClient(token?: string): WebClient {
    return new WebClient(token || config.slack.botToken);
  }

  static async sendMessage(channel: string, text: string, blocks?: any[], token?: string) {
    const client = SlackIntegration.getClient(token);
    await client.chat.postMessage({ channel, text, blocks });
  }

  static async handleSlashCommand(body: any, userId: string): Promise<any> {
    const command = body.command;
    const text = (body.text || '').trim();

    const integration = await prisma.integration.findFirst({
      where: { userId, type: 'SLACK', enabled: true },
    });
    if (!integration) return { text: '❌ Intégration Slack non configurée' };

    const intConfig = integration.config as any;

    try {
      if (command === '/workknock-factures') {
        const invoices = await prisma.invoice.findMany({
          where: { userId, ...(text ? { client: { name: { contains: text } } } : {}) },
          include: { client: { select: { name: true } } },
          orderBy: { issueDate: 'desc' },
          take: 10,
        });

        if (!invoices.length) return { text: '❌ Aucune facture trouvée' };

        const statusEmoji: any = { PAID: '✅', SENT: '📤', OVERDUE: '🔴', DRAFT: '📝' };
        const blocks = [
          { type: 'header', text: { type: 'plain_text', text: `📄 ${invoices.length} facture(s)` } },
          ...invoices.map(inv => ({
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Numéro:* ${statusEmoji[inv.status]} ${inv.number}` },
              { type: 'mrkdwn', text: `*Client:* ${inv.client.name}` },
              { type: 'mrkdwn', text: `*Montant:* ${fmt(inv.total)}` },
              { type: 'mrkdwn', text: `*Échéance:* ${new Date(inv.dueDate).toLocaleDateString('fr-FR')}` },
            ],
          })),
        ];
        return { blocks };
      }

      if (command === '/workknock-ca') {
        const year = text ? parseInt(text) : new Date().getFullYear();
        const revenue = await prisma.invoice.aggregate({
          where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
          _sum: { total: true }, _count: true,
        });
        const expenses = await prisma.expenseReport.aggregate({
          where: { userId, year },
          _sum: { total: true },
        });

        return {
          blocks: [{
            type: 'section',
            text: { type: 'mrkdwn', text: `📊 *Chiffre d'affaires ${year}*\n• CA: *${fmt(revenue._sum.total || 0)}*\n• Frais: ${fmt(expenses._sum.total || 0)}\n• ${revenue._count} facture(s) payée(s)` },
          }],
        };
      }

      if (command === '/workknock-impayes') {
        const invoices = await prisma.invoice.findMany({
          where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
          include: { client: { select: { name: true } } },
        });

        if (!invoices.length) return { text: '✅ Aucune facture impayée !' };

        const total = invoices.reduce((s, i) => s + i.total, 0);
        return {
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: `💸 ${invoices.length} impayé(s) - ${fmt(total)}` } },
            ...invoices.map(inv => ({
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*${inv.number}* - ${inv.client.name}` },
                { type: 'mrkdwn', text: `${fmt(inv.total)} ${inv.status === 'OVERDUE' ? '🔴 *EN RETARD*' : '🟡'}` },
              ],
            })),
          ],
        };
      }

      return { text: `Commandes disponibles: /workknock-factures, /workknock-ca, /workknock-impayes` };
    } catch (err) {
      console.error('[Slack] Error:', err);
      return { text: '❌ Erreur lors du traitement de la commande' };
    }
  }
}
