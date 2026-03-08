import axios from 'axios';
import FormData from 'form-data';
import { prisma } from '../utils/prisma';
import { PdfService } from '../services/pdf.service';
import { AIService } from '../services/ai.service';
import { config } from '../config';
import { generateInvoiceNumber } from '../utils/invoiceNumber';

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const statusEmoji: any = { PAID: '✅', SENT: '📤', OVERDUE: '🔴', DRAFT: '📝', CANCELLED: '❌' };

export class WhatsAppIntegration {
  static async sendMessage(phone: string, message: string, instanceId?: string, token?: string) {
    const id = instanceId || config.whatsapp.instanceId;
    const tk = token || config.whatsapp.apiToken;
    if (!id || !tk) return;

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;

    try {
      await axios.post(`${config.whatsapp.apiUrl}/waInstance${id}/sendMessage/${tk}`, {
        chatId, message,
      });
    } catch (err: any) {
      console.error('[WhatsApp] Send error:', err?.response?.data || err.message);
    }
  }

  static async sendFile(phone: string, fileBuffer: Buffer, filename: string, caption: string, instanceId?: string, token?: string) {
    const id = instanceId || config.whatsapp.instanceId;
    const tk = token || config.whatsapp.apiToken;
    if (!id || !tk) {
      console.error('[WhatsApp] sendFile: no instanceId or token');
      return;
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanPhone}@c.us`;

    try {
      // Green API sendFileByUpload requires multipart/form-data
      const form = new FormData();
      form.append('chatId', chatId);
      form.append('fileName', filename);
      form.append('caption', caption);
      form.append('file', fileBuffer, { filename, contentType: 'application/pdf' });

      // Use media host for file uploads as recommended by Green API
      const baseUrl = config.whatsapp.apiUrl || '';
      const mediaUrl = baseUrl.replace('api.green-api.com', 'media.green-api.com').replace('api.greenapi.com', 'media.greenapi.com');
      const url = `${mediaUrl}/waInstance${id}/sendFileByUpload/${tk}`;
      console.log('[WhatsApp] 📎 Sending file via form-data to:', url);
      console.log('[WhatsApp] 📎 chatId:', chatId, 'filename:', filename, 'size:', fileBuffer.length, 'bytes');

      const resp = await axios.post(url, form, {
        headers: { ...form.getHeaders() },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
      });
      console.log('[WhatsApp] ✅ File sent successfully:', JSON.stringify(resp.data));
    } catch (err: any) {
      console.error('[WhatsApp] ❌ File send error:', err?.response?.status, JSON.stringify(err?.response?.data) || err.message);
      // Fallback: try with base API URL
      try {
        console.log('[WhatsApp] 📎 Retrying with base API URL...');
        const form2 = new FormData();
        form2.append('chatId', chatId);
        form2.append('fileName', filename);
        form2.append('caption', caption);
        form2.append('file', fileBuffer, { filename, contentType: 'application/pdf' });
        const resp = await axios.post(`${config.whatsapp.apiUrl}/waInstance${id}/sendFileByUpload/${tk}`, form2, {
          headers: { ...form2.getHeaders() },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          timeout: 60000,
        });
        console.log('[WhatsApp] ✅ Fallback file sent OK:', JSON.stringify(resp.data));
      } catch (err2: any) {
        console.error('[WhatsApp] ❌ Fallback also failed:', err2?.response?.status, JSON.stringify(err2?.response?.data) || err2.message);
      }
    }
  }

  // ── Build context about the user for AI ──
  private static async buildUserContext(userId: string): Promise<string> {
    const [user, clients, recentInvoices, unpaid, settings] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
      prisma.client.findMany({ where: { userId, status: 'ACTIVE' }, select: { id: true, name: true, email: true }, take: 50 }),
      prisma.invoice.findMany({
        where: { userId }, include: { client: { select: { name: true } } },
        orderBy: { createdAt: 'desc' }, take: 10,
      }),
      prisma.invoice.findMany({
        where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
        include: { client: { select: { name: true } } },
      }),
      prisma.userSettings.findUnique({ where: { userId } }),
    ]);

    const year = new Date().getFullYear();
    const revenue = await prisma.invoice.aggregate({
      where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
      _sum: { total: true }, _count: true,
    });

    return `
Freelance: ${user?.name} (${user?.email})
Société: ${settings?.companyName || 'Non définie'}
Préfixe factures: ${settings?.invoicePrefix || 'FAC'}
Prochain n° facture: ${settings?.invoiceNextNumber || 1}
Taux TVA par défaut: ${settings?.taxRate || 20}%

CLIENTS ACTIFS (${clients.length}):
${clients.map(c => `- ${c.name} (${c.email || 'pas d\'email'})`).join('\n')}

DERNIÈRES FACTURES:
${recentInvoices.map(i => `- ${i.number} | ${i.client.name} | ${fmt(i.total)} | ${i.status}`).join('\n')}

IMPAYÉS: ${unpaid.length} facture(s) pour ${fmt(unpaid.reduce((s, i) => s + i.total, 0))}
${unpaid.map(i => `- ${i.number} | ${i.client.name} | ${fmt(i.total)} | échéance: ${new Date(i.dueDate).toLocaleDateString('fr-FR')}`).join('\n')}

CA ${year}: ${fmt(revenue._sum.total || 0)} (${revenue._count} factures payées)
CP restants: ${(settings?.cpPerYear || 25)} jours/an
`;
  }

  // ── Execute AI action ──
  private static async executeAction(action: string, data: any, userId: string): Promise<string> {
    try {
      switch (action) {
        case 'create_invoice': {
          const client = await prisma.client.findFirst({
            where: { userId, name: { contains: data.clientName } },
          });
          if (!client) return `❌ Client "${data.clientName}" non trouvé. Créez-le d'abord ou vérifiez le nom.`;

          const items = data.items || [];
          if (!items.length) return '❌ Aucun élément de facturation fourni.';

          const discount = data.discount || 0;
          const processedItems = items.map((item: any, idx: number) => {
            let unitPrice = item.unitPrice;
            if (discount > 0) unitPrice = unitPrice * (1 - discount / 100);
            return {
              description: item.description,
              quantity: item.quantity || 1,
              unitPrice: Math.round(unitPrice * 100) / 100,
              total: Math.round((item.quantity || 1) * unitPrice * 100) / 100,
              order: idx,
            };
          });

          const subtotal = processedItems.reduce((s: number, i: any) => s + i.total, 0);
          const taxRate = data.taxRate ?? 20;
          const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
          const total = Math.round((subtotal + taxAmount) * 100) / 100;
          const number = await generateInvoiceNumber(userId);

          const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
          const dueDate = data.dueDate ? new Date(data.dueDate) : new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

          const invoice = await prisma.invoice.create({
            data: {
              userId, clientId: client.id, number, taxRate,
              subtotal, taxAmount, total,
              issueDate, dueDate,
              notes: data.notes || (discount > 0 ? `Remise de ${discount}% appliquée` : undefined),
              items: { create: processedItems },
            },
            include: { client: true, items: true },
          });

          let msg = `✅ *Facture créée avec succès !*\n\n`;
          msg += `📄 N°: *${invoice.number}*\n`;
          msg += `👤 Client: ${client.name}\n`;
          msg += `📅 Date: ${issueDate.toLocaleDateString('fr-FR')}\n`;
          msg += `📅 Échéance: ${dueDate.toLocaleDateString('fr-FR')}\n`;
          if (discount > 0) msg += `🏷️ Remise: ${discount}%\n`;
          msg += `\n*Détails:*\n`;
          for (const item of processedItems) {
            msg += `• ${item.description}: ${item.quantity} × ${fmt(item.unitPrice)} = ${fmt(item.total)}\n`;
          }
          msg += `\n💰 Sous-total: ${fmt(subtotal)}\n`;
          msg += `📊 TVA (${taxRate}%): ${fmt(taxAmount)}\n`;
          msg += `💵 *Total TTC: ${fmt(total)}*`;
          return msg;
        }

        case 'list_invoices': {
          const where: any = { userId };
          if (data.status && data.status !== 'ALL') where.status = data.status;
          if (data.clientName) where.client = { name: { contains: data.clientName } };

          const invoices = await prisma.invoice.findMany({
            where, include: { client: { select: { name: true } } },
            orderBy: { issueDate: 'desc' }, take: 10,
          });
          if (!invoices.length) return '📄 Aucune facture trouvée.';

          let msg = `📄 *${invoices.length} facture(s):*\n\n`;
          for (const inv of invoices) {
            msg += `${statusEmoji[inv.status]} *${inv.number}* - ${inv.client.name}\n`;
            msg += `   💰 ${fmt(inv.total)} | 📅 ${new Date(inv.dueDate).toLocaleDateString('fr-FR')}\n\n`;
          }
          return msg;
        }

        case 'get_revenue': {
          const year = data.year || new Date().getFullYear();
          const [revenue, expenses] = await Promise.all([
            prisma.invoice.aggregate({
              where: { userId, status: 'PAID', issueDate: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } },
              _sum: { total: true }, _count: true,
            }),
            prisma.expenseReport.aggregate({ where: { userId, year }, _sum: { total: true } }),
          ]);
          const ca = revenue._sum.total || 0;
          const frais = expenses._sum.total || 0;
          return `📊 *Chiffre d'affaires ${year}:*\n\n💰 CA: ${fmt(ca)}\n🧾 Frais: ${fmt(frais)}\n📈 Net: ${fmt(ca - frais)}\n📄 ${revenue._count} facture(s) payée(s)`;
        }

        case 'list_unpaid': {
          const invoices = await prisma.invoice.findMany({
            where: { userId, status: { in: ['SENT', 'OVERDUE'] } },
            include: { client: { select: { name: true } } },
            orderBy: { dueDate: 'asc' },
          });
          if (!invoices.length) return '✅ Aucune facture impayée ! 🎉';
          const total = invoices.reduce((s, i) => s + i.total, 0);
          let msg = `💸 *${invoices.length} facture(s) impayée(s) - ${fmt(total)}:*\n\n`;
          for (const inv of invoices) {
            const overdue = inv.status === 'OVERDUE';
            const days = Math.ceil((Date.now() - new Date(inv.dueDate).getTime()) / 86400000);
            msg += `${overdue ? '🔴' : '🟡'} *${inv.number}* - ${inv.client.name}\n`;
            msg += `   💰 ${fmt(inv.total)} ${overdue ? `(${days}j de retard)` : ''}\n\n`;
          }
          return msg;
        }

        case 'create_client': {
          const existing = await prisma.client.findFirst({
            where: { userId, name: { contains: data.name } },
          });
          if (existing) return `⚠️ Un client "${existing.name}" existe déjà.`;

          const client = await prisma.client.create({
            data: {
              userId, name: data.name, email: data.email || null,
              phone: data.phone || null, address: data.address || null,
              city: data.city || null, postalCode: data.postalCode || null,
              siret: data.siret || null,
            },
          });
          return `✅ Client *${client.name}* créé !\n${client.email ? `📧 ${client.email}` : ''}`;
        }

        case 'get_leaves': {
          const year = new Date().getFullYear();
          const settings = await prisma.userSettings.findUnique({ where: { userId } });
          const approved = await prisma.leave.findMany({
            where: { userId, status: 'APPROVED', startDate: { gte: new Date(`${year}-01-01`) } },
          });
          const usedCP = approved.filter(l => l.type === 'CP').reduce((s, l) => s + l.days, 0);
          const usedRTT = approved.filter(l => l.type === 'RTT').reduce((s, l) => s + l.days, 0);
          return `🏖️ *Congés ${year}:*\n\n🌴 CP: ${(settings?.cpPerYear || 25) - usedCP}/${settings?.cpPerYear || 25}\n☀️ RTT: ${(settings?.rttPerYear || 0) - usedRTT}/${settings?.rttPerYear || 0}`;
        }

        case 'list_clients': {
          const clients = await prisma.client.findMany({
            where: { userId, status: 'ACTIVE' }, take: 20, orderBy: { name: 'asc' },
          });
          if (!clients.length) return '👤 Aucun client. Dites "crée un client NomDuClient" !';
          let msg = `👤 *${clients.length} client(s):*\n\n`;
          for (const c of clients) msg += `• *${c.name}*${c.email ? ` - ${c.email}` : ''}\n`;
          return msg;
        }

        case 'create_expense': {
          const month = new Date().getMonth() + 1;
          const year = new Date().getFullYear();
          const items = data.items || [];
          const total = items.reduce((s: number, i: any) => s + (i.amount || 0), 0);

          await prisma.expenseReport.create({
            data: {
              userId, title: data.title || `Frais ${month}/${year}`,
              month, year, total,
              items: {
                create: items.map((item: any) => ({
                  date: new Date(item.date || new Date()),
                  category: item.category || 'AUTRE',
                  description: item.description,
                  amount: item.amount,
                  merchant: item.merchant || null,
                  isReimbursable: true,
                })),
              },
            },
          });
          return `✅ Note de frais créée !\n📋 ${data.title || `Frais ${month}/${year}`}\n💰 Total: ${fmt(total)}`;
        }

        case 'mark_paid': {
          const invoice = await prisma.invoice.findFirst({
            where: { userId, number: { contains: data.invoiceNumber } },
            include: { client: { select: { name: true } } },
          });
          if (!invoice) return `❌ Facture "${data.invoiceNumber}" non trouvée.`;
          if (invoice.status === 'PAID') return `✅ ${invoice.number} déjà payée.`;

          await prisma.payment.create({
            data: { invoiceId: invoice.id, amount: data.amount || invoice.total, date: new Date(), method: data.method || 'virement' },
          });
          await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'PAID', paidAt: new Date() } });
          return `✅ *${invoice.number}* marquée payée !\n👤 ${invoice.client.name}\n💰 ${fmt(data.amount || invoice.total)}`;
        }

        case 'send_invoice': {
          const invoice = await prisma.invoice.findFirst({
            where: { userId, number: { contains: data.invoiceNumber } },
            include: { client: true, items: true, user: { include: { settings: true } } },
          });
          if (!invoice) return `❌ Facture "${data.invoiceNumber}" non trouvée.`;

          await prisma.invoice.update({ where: { id: invoice.id }, data: { status: 'SENT', sentAt: new Date() } });
          return `📤 Facture *${invoice.number}* envoyée !\n👤 ${invoice.client.name}\n💰 ${fmt(invoice.total)}`;
        }

        case 'create_leave': {
          const startDate = data.startDate ? new Date(data.startDate) : new Date();
          const endDate = data.endDate ? new Date(data.endDate) : startDate;
          const days = data.days || Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
          const type = data.type || 'CP';

          const leave = await prisma.leave.create({
            data: {
              userId,
              type,
              startDate,
              endDate,
              days,
              reason: data.reason || '',
              status: 'PENDING',
            },
          });
          return `✅ *Congé créé !*\n\n🏖️ Type: ${type}\n📅 Du ${startDate.toLocaleDateString('fr-FR')} au ${endDate.toLocaleDateString('fr-FR')}\n📆 ${days} jour(s)\n${data.reason ? `📝 Motif: ${data.reason}` : ''}\n⏳ Statut: En attente`;
        }

        case 'get_invoice_pdf': {
          const invoice = await prisma.invoice.findFirst({
            where: { userId, number: { contains: data.invoiceNumber } },
            include: { client: true, items: true, user: { include: { settings: true } } },
          });
          if (!invoice) return `❌ Facture "${data.invoiceNumber}" non trouvée.`;
          return `__PDF_INVOICE__${invoice.id}`;
        }

        case 'get_expense_pdf': {
          const expense = await prisma.expenseReport.findFirst({
            where: { userId, title: { contains: data.title || '' } },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
          });
          if (!expense) return `❌ Note de frais non trouvée.`;
          return `__PDF_EXPENSE__${expense.id}`;
        }

        default:
          return `❓ Action inconnue: ${action}. Actions disponibles: create_invoice, list_invoices, get_revenue, list_unpaid, create_client, get_leaves, list_clients, create_expense, mark_paid, send_invoice, create_leave, get_invoice_pdf, get_expense_pdf`;
      }
    } catch (err: any) {
      console.error(`[WhatsApp AI] Action ${action} error:`, err);
      return `❌ Erreur: ${err.message}`;
    }
  }

  // ── Global webhook: resolve user by phone, then process ──
  static async handleGlobalWebhook(body: any) {
    console.log('[WA-GLOBAL] 📩 handleGlobalWebhook called');

    // Green API sends data directly OR nested in body
    const messageData = body?.typeWebhook ? body : body?.body;
    console.log('[WA-GLOBAL] typeWebhook:', messageData?.typeWebhook);
    console.log('[WA-GLOBAL] senderData:', JSON.stringify(messageData?.senderData));
    console.log('[WA-GLOBAL] messageData:', JSON.stringify(messageData?.messageData));

    if (!messageData || messageData.typeWebhook !== 'incomingMessageReceived') {
      console.log('[WA-GLOBAL] ⏭️  Skipped: not incomingMessageReceived, got:', messageData?.typeWebhook);
      return;
    }

    const senderPhone = messageData.senderData?.chatId?.replace('@c.us', '') ||
                         messageData.senderData?.sender?.replace('@c.us', '');
    console.log('[WA-GLOBAL] 📱 Sender phone:', senderPhone);
    if (!senderPhone) {
      console.log('[WA-GLOBAL] ⏭️  No sender phone found');
      return;
    }

    // 1. Try to find user by phone number (try multiple formats)
    let user = await prisma.user.findUnique({ where: { phone: senderPhone } });
    if (!user) user = await prisma.user.findUnique({ where: { phone: `+${senderPhone}` } });
    if (!user) user = await prisma.user.findFirst({ where: { phone: { endsWith: senderPhone.slice(-9) } } });

    console.log('[WA-GLOBAL] 👤 User found:', user ? `${user.name} (${user.id})` : 'NOT FOUND');

    if (!user) {
      console.log(`[WA-GLOBAL] ❌ No user for phone: ${senderPhone}`);
      await WhatsAppIntegration.sendMessage(senderPhone,
        '❓ Numéro non reconnu.\n\nConnectez votre WhatsApp sur *WorkKnock* → page *Intégrations* → entrez votre numéro et scannez le QR code.');
      return;
    }

    // 2. Process message for registered user
    console.log('[WA-GLOBAL] ✅ Forwarding to handleWebhook for user:', user.name);
    await WhatsAppIntegration.handleWebhook(body, user.id);
  }

  // ── Main webhook handler with AI (uses shared instance) ──
  static async handleWebhook(body: any, userId: string) {
    console.log('[WA-HANDLE] 🔄 handleWebhook called for userId:', userId);

    // Green API sends data directly OR nested in body
    const messageData = body?.typeWebhook ? body : body?.body;
    if (!messageData || messageData.typeWebhook !== 'incomingMessageReceived') {
      console.log('[WA-HANDLE] ⏭️  Skipped: typeWebhook =', messageData?.typeWebhook);
      return;
    }

    const senderPhone = messageData.senderData?.chatId?.replace('@c.us', '') ||
                         messageData.senderData?.sender?.replace('@c.us', '');

    // Log raw messageData to debug structure
    const msgData = messageData.messageData;
    console.log('[WA-HANDLE] 📦 Raw messageData:', JSON.stringify(msgData));
    console.log('[WA-HANDLE] 📦 typeMessage:', msgData?.typeMessage);

    // Extract text from ALL possible Green API message types
    let text: string | undefined;
    if (msgData?.textMessageData?.textMessage) {
      text = msgData.textMessageData.textMessage;
    } else if (msgData?.extendedTextMessageData?.text) {
      text = msgData.extendedTextMessageData.text;
    } else if (msgData?.imageMessageData?.caption) {
      text = msgData.imageMessageData.caption;
    } else if (msgData?.documentMessageData?.caption) {
      text = msgData.documentMessageData.caption;
    } else if (msgData?.contactMessageData?.displayName) {
      text = `Contact: ${msgData.contactMessageData.displayName}`;
    }
    text = text?.trim();

    console.log('[WA-HANDLE] 📱 Phone:', senderPhone, '| 💬 Text:', text);
    if (!text || !senderPhone) {
      console.log('[WA-HANDLE] ⏭️  No text or phone');
      return;
    }

    try {
      console.log('[WA-HANDLE] 🧠 Building user context...');
      const context = await WhatsAppIntegration.buildUserContext(userId);
      console.log('[WA-HANDLE] 🤖 Calling AI with message:', text);
      const aiResponse = await AIService.chat(text, context);
      console.log('[WA-HANDLE] 📝 AI response:', aiResponse.substring(0, 200));

      console.log('[WA-HANDLE] 🔍 isAction?', AIService.isAction(aiResponse));

      if (AIService.isAction(aiResponse)) {
        const parsed = AIService.parseAction(aiResponse);
        console.log('[WA-HANDLE] 📋 Parsed:', parsed ? `action=${parsed.action}` : 'FAILED TO PARSE');
        if (parsed) {
          const result = await WhatsAppIntegration.executeAction(parsed.action, parsed.data, userId);
          console.log('[WA-HANDLE] 📦 Action result (first 200):', result.substring(0, 200));

          // Handle PDF responses
          if (result.startsWith('__PDF_INVOICE__')) {
            console.log('[WA-HANDLE] 📄 PDF INVOICE marker detected!');
            const invoiceId = result.replace('__PDF_INVOICE__', '');
            const invoice = await prisma.invoice.findUnique({
              where: { id: invoiceId },
              include: { client: true, items: true, user: { include: { settings: true } } },
            });
            if (invoice) {
              await WhatsAppIntegration.sendMessage(senderPhone, `📄 Voici la facture *${invoice.number}* pour ${invoice.client.name} (${fmt(invoice.total)})`);
              const pdf = await PdfService.generateInvoice(invoice);
              await WhatsAppIntegration.sendFile(senderPhone, pdf, `facture-${invoice.number}.pdf`, `📄 Facture ${invoice.number}`);
            } else {
              await WhatsAppIntegration.sendMessage(senderPhone, '❌ Facture introuvable.');
            }
          } else if (result.startsWith('__PDF_EXPENSE__')) {
            console.log('[WA-HANDLE] 🧾 PDF EXPENSE marker detected!');
            const expenseId = result.replace('__PDF_EXPENSE__', '');
            const expense = await prisma.expenseReport.findUnique({
              where: { id: expenseId },
              include: { items: true },
            });
            if (expense) {
              await WhatsAppIntegration.sendMessage(senderPhone, `🧾 Voici la note de frais *${expense.title}* (${fmt(expense.total)})`);
              // Send expense summary as message (PDF generation can be added later)
              let msg = `📋 *${expense.title}*\n\n`;
              for (const item of expense.items) {
                msg += `• ${new Date(item.date).toLocaleDateString('fr-FR')} - ${item.description}: ${fmt(item.amount)}\n`;
              }
              msg += `\n💰 *Total: ${fmt(expense.total)}*`;
              await WhatsAppIntegration.sendMessage(senderPhone, msg);
            } else {
              await WhatsAppIntegration.sendMessage(senderPhone, '❌ Note de frais introuvable.');
            }
          } else {
            await WhatsAppIntegration.sendMessage(senderPhone, result);
          }

          // If invoice was created, also send the PDF
          if (parsed.action === 'create_invoice' && result.includes('Facture créée')) {
            const numberMatch = result.match(/N°: \*([^*]+)\*/);
            if (numberMatch) {
              const invoice = await prisma.invoice.findFirst({
                where: { userId, number: numberMatch[1] },
                include: { client: true, items: true, user: { include: { settings: true } } },
              });
              if (invoice) {
                const pdf = await PdfService.generateInvoice(invoice);
                await WhatsAppIntegration.sendFile(senderPhone, pdf, `facture-${invoice.number}.pdf`, `📄 Facture ${invoice.number}`);
              }
            }
          }
        } else {
          // AI responded with something that looks like JSON but couldn't parse
          console.log('[WA-HANDLE] ⚠️ isAction=true but parseAction failed! Raw:', aiResponse.substring(0, 300));
          // Remove JSON fragments and send readable text
          let cleanResponse = aiResponse
            .replace(/```json\n?/g, '').replace(/```\n?/g, '')
            .replace(/\{[\s\S]*\}/g, '') // Remove JSON blocks
            .trim();
          if (!cleanResponse || cleanResponse.length < 5) {
            cleanResponse = '🤖 J\'ai compris votre demande mais j\'ai rencontré un problème technique. Pouvez-vous reformuler ?';
          }
          await WhatsAppIntegration.sendMessage(senderPhone, cleanResponse);
        }
      } else {
        await WhatsAppIntegration.sendMessage(senderPhone, aiResponse);
      }
    } catch (err) {
      console.error('[WhatsApp] Error:', err);
      await WhatsAppIntegration.sendMessage(senderPhone, '❌ Erreur. Réessayez.');
    }
  }

  // ── Send notification (for automatic events) ──
  static async sendNotification(userId: string, message: string) {
    const integration = await prisma.integration.findFirst({
      where: { userId, type: 'WHATSAPP', enabled: true },
    });
    if (!integration) return;

    const intConfig = integration.config as any;
    const phone = intConfig.phone;
    if (!phone) return;

    await WhatsAppIntegration.sendMessage(phone, message);
  }
}
