import axios from 'axios';
import { prisma } from '../utils/prisma';
import { config } from '../config';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export class TeamsIntegration {
  static async sendWebhookMessage(webhookUrl: string, message: any) {
    await axios.post(webhookUrl, message);
  }

  static buildAdaptiveCard(title: string, body: any[]): any {
    return {
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Large', weight: 'Bolder', text: title, color: 'Accent' },
            ...body,
          ],
        },
      }],
    };
  }

  static async handleWebhook(body: any, userId: string): Promise<any> {
    const text = (body?.text || '').toLowerCase().trim();
    const integration = await prisma.integration.findFirst({
      where: { userId, type: 'TEAMS', enabled: true },
    });
    if (!integration) return { type: 'message', text: '❌ Intégration Teams non configurée' };

    try {
      if (text.includes('factures') || text.includes('invoice')) {
        const invoices = await prisma.invoice.findMany({
          where: { userId },
          include: { client: { select: { name: true } } },
          orderBy: { issueDate: 'desc' }, take: 5,
        });

        const statusMap: any = { PAID: '✅', SENT: '📤', OVERDUE: '🔴', DRAFT: '📝' };
        const facts = invoices.map(inv => ({
          type: 'FactSet',
          facts: [
            { title: 'N°', value: `${statusMap[inv.status]} ${inv.number}` },
            { title: 'Client', value: inv.client.name },
            { title: 'Montant', value: fmt(inv.total) },
          ],
        }));

        return TeamsIntegration.buildAdaptiveCard(`📄 ${invoices.length} Factures`, facts);
      }

      if (text.includes('ca') || text.includes('chiffre')) {
        const year = new Date().getFullYear();
        const revenue = await prisma.invoice.aggregate({
          where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`) } },
          _sum: { total: true }, _count: true,
        });

        return TeamsIntegration.buildAdaptiveCard(`📊 CA ${year}`, [
          { type: 'FactSet', facts: [
            { title: 'Chiffre d\'affaires', value: `**${fmt(revenue._sum.total || 0)}**` },
            { title: 'Factures payées', value: String(revenue._count) },
          ]},
        ]);
      }

      if (text.includes('impay')) {
        const invoices = await prisma.invoice.findMany({
          where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
          include: { client: { select: { name: true } } },
        });
        const total = invoices.reduce((s, i) => s + i.total, 0);

        return TeamsIntegration.buildAdaptiveCard(`💸 ${invoices.length} Impayé(s)`, [
          { type: 'TextBlock', text: `Total: ${fmt(total)}`, weight: 'Bolder', color: 'Attention' },
          ...invoices.map(inv => ({ type: 'TextBlock', text: `• ${inv.number} - ${inv.client.name} - ${fmt(inv.total)}` })),
        ]);
      }

      return {
        type: 'message',
        text: 'Dites "factures", "ca" ou "impayes" pour obtenir des informations WorkKnock.',
      };
    } catch (err) {
      console.error('[Teams] Error:', err);
      return { type: 'message', text: '❌ Erreur de traitement' };
    }
  }
}
