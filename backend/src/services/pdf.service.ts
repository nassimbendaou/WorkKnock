import PDFDocument from 'pdfkit';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const formatDate = (date: Date | string) =>
  new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

const drawLine = (doc: PDFKit.PDFDocument, y: number) => {
  doc.moveTo(40, y).lineTo(555, y).strokeColor('#e2e8f0').lineWidth(1).stroke();
};

export class PdfService {
  static async generateInvoice(invoice: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const settings = invoice.user?.settings;
      const companyName = settings?.companyName || invoice.user?.name || 'Freelance';
      const primaryColor = '#4f46e5';

      // ── Header ──
      doc.rect(0, 0, 595, 120).fill(primaryColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(28).text('FACTURE', 40, 35);
      doc.fontSize(12).text(`N° ${invoice.number}`, 40, 68);
      doc.fontSize(10).text(formatDate(invoice.issueDate), 40, 85);

      // Company info (right)
      doc.font('Helvetica-Bold').fontSize(14).text(companyName, 300, 35, { align: 'right', width: 255 });
      if (settings?.companyAddress) doc.font('Helvetica').fontSize(9).text(settings.companyAddress, 300, 55, { align: 'right', width: 255 });
      if (settings?.companySiret) doc.text(`SIRET: ${settings.companySiret}`, 300, 68, { align: 'right', width: 255 });
      if (settings?.companyTva) doc.text(`TVA: ${settings.companyTva}`, 300, 78, { align: 'right', width: 255 });

      // ── Client info ──
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(11).text('FACTURÉ À:', 40, 140);
      doc.font('Helvetica').fontSize(10);
      doc.text(invoice.client.name, 40, 158);
      if (invoice.client.address) doc.text(invoice.client.address, 40, 172);
      const cityLine = [invoice.client.postalCode, invoice.client.city].filter(Boolean).join(' ');
      if (cityLine) doc.text(cityLine, 40, 185);
      if (invoice.client.tva) doc.text(`TVA: ${invoice.client.tva}`, 40, 198);

      // Dates (right)
      doc.font('Helvetica-Bold').text('Date d\'émission:', 320, 158);
      doc.font('Helvetica').text(formatDate(invoice.issueDate), 450, 158);
      doc.font('Helvetica-Bold').text('Date d\'échéance:', 320, 172);
      doc.font('Helvetica').text(formatDate(invoice.dueDate), 450, 172);

      const statusColors: any = { PAID: '#16a34a', SENT: '#2563eb', OVERDUE: '#dc2626', DRAFT: '#6b7280' };
      const statusLabels: any = { PAID: 'PAYÉE', SENT: 'ENVOYÉE', OVERDUE: 'EN RETARD', DRAFT: 'BROUILLON' };
      doc.roundedRect(450, 192, 90, 22, 4).fill(statusColors[invoice.status] || '#6b7280');
      doc.fillColor('white').font('Helvetica-Bold').fontSize(9).text(statusLabels[invoice.status] || invoice.status, 455, 199, { width: 80, align: 'center' });

      // ── Items table ──
      let y = 250;
      doc.rect(40, y, 515, 28).fill('#f8fafc');
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(9);
      doc.text('DESCRIPTION', 50, y + 9);
      doc.text('QTÉ', 360, y + 9, { width: 50, align: 'right' });
      doc.text('PRIX UNIT.', 415, y + 9, { width: 70, align: 'right' });
      doc.text('TOTAL', 490, y + 9, { width: 60, align: 'right' });

      y += 28;
      doc.font('Helvetica').fontSize(9).fillColor('#1e293b');

      for (const item of invoice.items || []) {
        drawLine(doc, y);
        doc.text(item.description, 50, y + 8, { width: 300 });
        doc.text(String(item.quantity), 360, y + 8, { width: 50, align: 'right' });
        doc.text(formatMoney(item.unitPrice), 415, y + 8, { width: 70, align: 'right' });
        doc.text(formatMoney(item.total), 490, y + 8, { width: 60, align: 'right' });
        y += 30;
      }

      drawLine(doc, y);
      y += 15;

      // ── Totals ──
      const totalsX = 370;
      doc.font('Helvetica').fontSize(10).fillColor('#374151');
      doc.text('Sous-total HT:', totalsX, y);
      doc.text(formatMoney(invoice.subtotal), 490, y, { width: 60, align: 'right' });
      y += 20;
      doc.text(`TVA (${invoice.taxRate}%):`, totalsX, y);
      doc.text(formatMoney(invoice.taxAmount), 490, y, { width: 60, align: 'right' });
      y += 10;
      drawLine(doc, y + 5);
      y += 15;
      doc.rect(355, y, 200, 32).fill(primaryColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(13).text('TOTAL TTC:', 365, y + 8);
      doc.text(formatMoney(invoice.total), 445, y + 8, { width: 100, align: 'right' });
      y += 50;

      // ── Payment info ──
      if (settings?.bankIban || invoice.notes || invoice.paymentTerms) {
        doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10).text('INFORMATIONS DE PAIEMENT', 40, y);
        y += 18;
        doc.font('Helvetica').fontSize(9).fillColor('#6b7280');
        if (settings?.bankIban) {
          doc.text(`IBAN: ${settings.bankIban}`, 40, y);
          y += 13;
          if (settings?.bankBic) { doc.text(`BIC: ${settings.bankBic}`, 40, y); y += 13; }
        }
        if (invoice.paymentTerms) { doc.text(`Conditions: ${invoice.paymentTerms}`, 40, y); y += 13; }
        if (invoice.notes) { doc.text(invoice.notes, 40, y, { width: 515 }); }
      }

      // ── Footer ──
      doc.rect(0, 790, 595, 52).fill('#f1f5f9');
      doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
        .text(`${companyName} • Merci pour votre confiance`, 40, 800, { align: 'center', width: 515 });

      doc.end();
    });
  }

  static async generateExpenseReport(report: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const settings = report.user?.settings;
      const companyName = settings?.companyName || report.user?.name || 'Freelance';
      const primaryColor = '#4f46e5';
      const monthName = MONTHS_FR[report.month - 1];

      // Header
      doc.rect(0, 0, 595, 100).fill(primaryColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(24).text('NOTE DE FRAIS', 40, 30);
      doc.fontSize(12).font('Helvetica').text(`${monthName} ${report.year}`, 40, 60);
      doc.font('Helvetica-Bold').fontSize(14).text(companyName, 300, 35, { align: 'right', width: 255 });

      let y = 120;
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text(report.title, 40, y);
      y += 30;

      // Table header
      doc.rect(40, y, 515, 25).fill('#f8fafc');
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8);
      doc.text('DATE', 50, y + 7);
      doc.text('CATÉGORIE', 120, y + 7);
      doc.text('DESCRIPTION', 220, y + 7);
      doc.text('COMMERÇANT', 360, y + 7);
      doc.text('MONTANT', 475, y + 7, { width: 75, align: 'right' });
      y += 25;

      const catLabels: any = {
        TRANSPORT: 'Transport', REPAS: 'Repas', HEBERGEMENT: 'Hébergement',
        MATERIEL: 'Matériel', LOGICIEL: 'Logiciel', TELEPHONE: 'Téléphone',
        FORMATION: 'Formation', AUTRE: 'Autre',
      };

      doc.font('Helvetica').fontSize(8).fillColor('#1e293b');
      let total = 0;
      for (const item of report.items || []) {
        drawLine(doc, y);
        doc.text(new Date(item.date).toLocaleDateString('fr-FR'), 50, y + 6, { width: 65 });
        doc.text(catLabels[item.category] || item.category, 120, y + 6, { width: 95 });
        doc.text(item.description, 220, y + 6, { width: 135 });
        doc.text(item.merchant || '-', 360, y + 6, { width: 110 });
        doc.text(formatMoney(item.amount), 475, y + 6, { width: 75, align: 'right' });
        total += item.amount;
        y += 22;
      }

      drawLine(doc, y);
      y += 15;
      doc.rect(380, y, 175, 30).fill(primaryColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(12).text('TOTAL:', 390, y + 8);
      doc.text(formatMoney(total), 430, y + 8, { width: 115, align: 'right' });

      doc.end();
    });
  }

  static async generatePaySlip(paySlip: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const settings = paySlip.user?.settings;
      const name = paySlip.user?.name || 'Freelance';
      const companyName = settings?.companyName || name;
      const monthName = MONTHS_FR[paySlip.month - 1];
      const primaryColor = '#4f46e5';

      // Header
      doc.rect(0, 0, 595, 100).fill(primaryColor);
      doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('BULLETIN DE PAIE', 40, 28);
      doc.fontSize(12).font('Helvetica').text(`${monthName} ${paySlip.year}`, 40, 58);
      doc.font('Helvetica-Bold').fontSize(14).text(companyName, 300, 35, { align: 'right', width: 255 });

      let y = 120;

      // Employee info
      doc.rect(40, y, 515, 70).stroke('#e2e8f0');
      doc.fillColor('#374151').font('Helvetica-Bold').fontSize(10).text('SALARIÉ:', 55, y + 12);
      doc.font('Helvetica').text(name, 130, y + 12);
      if (paySlip.user?.email) doc.text(paySlip.user.email, 130, y + 27);

      y += 90;

      // Salary breakdown
      const rows = [
        { label: 'Salaire brut', amount: paySlip.grossAmount, bold: true, bg: '#f8fafc' },
        { label: '━ URSSAF / Cotisations sociales', amount: -paySlip.urssafAmount, color: '#dc2626' },
        { label: '━ CSG / CRDS', amount: -paySlip.csgAmount, color: '#dc2626' },
        { label: '━ Retraite complémentaire', amount: -paySlip.retirementAmount, color: '#dc2626' },
        { label: 'Total des retenues', amount: -paySlip.socialCharges, bold: true, bg: '#fff1f2' },
        { label: 'SALAIRE NET À PAYER', amount: paySlip.netAmount, bold: true, bg: '#f0fdf4', big: true },
      ];

      for (const row of rows) {
        if (row.bg) doc.rect(40, y, 515, 28).fill(row.bg);
        const color = row.color || '#1e293b';
        doc.fillColor(color).font(row.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(row.big ? 12 : 10);
        doc.text(row.label, 55, y + 8);
        doc.text(formatMoney(row.amount), 440, y + 8, { width: 100, align: 'right' });
        drawLine(doc, y + 28);
        y += 28;
      }

      if (paySlip.notes) {
        y += 20;
        doc.fillColor('#6b7280').font('Helvetica').fontSize(9).text(paySlip.notes, 40, y, { width: 515 });
      }

      doc.end();
    });
  }
}
