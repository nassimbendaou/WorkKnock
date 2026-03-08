import { prisma } from '../utils/prisma';
import { WhatsAppIntegration } from '../integrations/whatsapp.integration';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export class NotificationService {
  static async create(userId: string, type: string, title: string, message: string, data?: any) {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, data },
    });

    // Also send WhatsApp notification for important events
    const whatsappMessages: Record<string, string> = {
      INVOICE_CREATED: `📄 ${title}\n${message}`,
      INVOICE_SENT: `📤 ${title}\n${message}`,
      INVOICE_PAID: `✅💰 ${title}\n${message}`,
      INVOICE_OVERDUE: `🔴 ${title}\n${message}`,
      PAYMENT_RECEIVED: `💵 ${title}\n${message}`,
      LEAVE_APPROVED: `✅🏖️ ${title}\n${message}`,
      LEAVE_REJECTED: `❌🏖️ ${title}\n${message}`,
    };

    if (whatsappMessages[type]) {
      WhatsAppIntegration.sendNotification(userId, whatsappMessages[type]).catch(err => {
        console.error('[Notification→WhatsApp] Error:', err.message);
      });
    }

    return notification;
  }
}
