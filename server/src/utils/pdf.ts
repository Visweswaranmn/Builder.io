import PDFDocument from 'pdfkit';
import type { InvoiceDocument } from '../models/invoice.model.js';
import type { InvoicePayment } from '../services/invoice.service.js';

const CURRENCY = (n: number) => `Rs. ${n.toFixed(2)}`;

/**
 * Builds a PDF invoice document. Returns the (unended) PDFKit document so the
 * caller can `.pipe(res)` and then `.end()` — keeping the HTTP response
 * concerns in the controller and the layout concerns here.
 */
export function buildInvoicePdf(invoice: InvoiceDocument): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });
  const project = invoice.project as unknown as { name?: string } | null;

  doc.fontSize(20).text('INVOICE', { align: 'right' });
  doc.fontSize(10).text(invoice.invoiceNumber, { align: 'right' });
  doc.moveDown(2);

  doc.fontSize(12).text(`Bill To: ${invoice.client}`);
  if (project?.name) doc.text(`Project: ${project.name}`);
  doc.text(`Issue Date: ${invoice.issueDate.toDateString()}`);
  if (invoice.dueDate) doc.text(`Due Date: ${invoice.dueDate.toDateString()}`);
  doc.text(`Status: ${invoice.status.toUpperCase()}`);
  doc.moveDown(1.5);

  const tableTop = doc.y;
  doc.fontSize(10).text('Description', 50, tableTop);
  doc.text('Qty', 300, tableTop, { width: 60, align: 'right' });
  doc.text('Unit Price', 360, tableTop, { width: 90, align: 'right' });
  doc.text('Amount', 460, tableTop, { width: 90, align: 'right' });
  doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

  let y = tableTop + 22;
  for (const item of invoice.items) {
    doc.text(item.description, 50, y, { width: 240 });
    doc.text(String(item.quantity), 300, y, { width: 60, align: 'right' });
    doc.text(CURRENCY(item.unitPrice), 360, y, { width: 90, align: 'right' });
    doc.text(CURRENCY(item.amount), 460, y, { width: 90, align: 'right' });
    y += 20;
  }

  doc.moveTo(50, y + 5).lineTo(550, y + 5).stroke();
  y += 15;

  const amountPaid = invoice.payments.reduce((sum: number, p) => sum + p.amount, 0);
  const balanceDue = Math.max(invoice.total - amountPaid, 0);

  const summaryLine = (label: string, value: string, bold = false) => {
    doc.fontSize(bold ? 12 : 10).text(label, 360, y, { width: 90, align: 'right' });
    doc.text(value, 460, y, { width: 90, align: 'right' });
    y += bold ? 22 : 18;
  };

  summaryLine('Subtotal', CURRENCY(invoice.subtotal));
  summaryLine(`GST (${invoice.gstRate}%)`, CURRENCY(invoice.gstAmount));
  summaryLine('Total', CURRENCY(invoice.total), true);
  summaryLine('Paid', CURRENCY(amountPaid));
  summaryLine('Balance Due', CURRENCY(balanceDue), true);

  return doc;
}

/** Builds a small PDF receipt for a single recorded payment. */
export function buildReceiptPdf(
  invoice: InvoiceDocument,
  payment: InvoicePayment,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({ margin: 50 });

  doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(12);
  doc.text(`Invoice: ${invoice.invoiceNumber}`);
  doc.text(`Client: ${invoice.client}`);
  doc.moveDown();
  doc.text(`Amount Received: ${CURRENCY(payment.amount)}`);
  doc.text(`Date: ${payment.date.toDateString()}`);
  doc.text(`Method: ${payment.method}`);
  if (payment.reference) doc.text(`Reference: ${payment.reference}`);

  return doc;
}
