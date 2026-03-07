import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: { user: config.smtp.user, pass: config.smtp.pass },
});

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

export class EmailService {
  static async sendInvoice(invoice: any, pdfBuffer: Buffer) {
    const client = invoice.client;
    const settings = invoice.user?.settings;
    const companyName = settings?.companyName || invoice.user?.name;

    await transporter.sendMail({
      from: config.smtp.from,
      to: client.email,
      subject: `Facture ${invoice.number} - ${companyName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #4f46e5; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">Nouvelle Facture</h1>
          </div>
          <div style="padding: 30px; background: #f8fafc; border: 1px solid #e2e8f0;">
            <p>Bonjour ${client.contactName || client.name},</p>
            <p>Veuillez trouver ci-joint la facture <strong>${invoice.number}</strong> d'un montant de <strong>${formatMoney(invoice.total)} TTC</strong>.</p>
            <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #e2e8f0;">
              <table style="width: 100%;">
                <tr><td style="color: #6b7280;">Numéro:</td><td style="font-weight: bold;">${invoice.number}</td></tr>
                <tr><td style="color: #6b7280;">Date:</td><td>${new Date(invoice.issueDate).toLocaleDateString('fr-FR')}</td></tr>
                <tr><td style="color: #6b7280;">Échéance:</td><td style="color: #dc2626; font-weight: bold;">${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}</td></tr>
                <tr><td style="color: #6b7280;">Montant HT:</td><td>${formatMoney(invoice.subtotal)}</td></tr>
                <tr><td style="color: #6b7280;">TVA (${invoice.taxRate}%):</td><td>${formatMoney(invoice.taxAmount)}</td></tr>
                <tr><td style="color: #6b7280; font-weight: bold;">Total TTC:</td><td style="font-size: 18px; font-weight: bold; color: #4f46e5;">${formatMoney(invoice.total)}</td></tr>
              </table>
            </div>
            ${settings?.bankIban ? `<p style="color: #6b7280; font-size: 13px;">IBAN: ${settings.bankIban}${settings.bankBic ? ` • BIC: ${settings.bankBic}` : ''}</p>` : ''}
            <p>Cordialement,<br><strong>${companyName}</strong></p>
          </div>
        </div>
      `,
      attachments: [{
        filename: `facture-${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });
  }

  static async sendReminder(invoice: any, pdfBuffer: Buffer) {
    const client = invoice.client;
    const daysLate = Math.ceil((Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24));

    await transporter.sendMail({
      from: config.smtp.from,
      to: client.email,
      subject: `Relance - Facture ${invoice.number} en attente de paiement`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #dc2626; padding: 30px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Rappel de Paiement</h1>
          </div>
          <div style="padding: 30px; background: #fef2f2; border: 1px solid #fecaca;">
            <p>Bonjour ${client.contactName || client.name},</p>
            <p>Sauf erreur de notre part, la facture <strong>${invoice.number}</strong> d'un montant de <strong>${formatMoney(invoice.total)} TTC</strong> n'a pas encore été réglée.</p>
            <p style="color: #dc2626;">Elle est en retard de <strong>${daysLate} jour(s)</strong> (échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}).</p>
            <p>Merci de procéder au règlement dans les meilleurs délais.</p>
          </div>
        </div>
      `,
      attachments: [{
        filename: `facture-${invoice.number}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }],
    });
  }
}
