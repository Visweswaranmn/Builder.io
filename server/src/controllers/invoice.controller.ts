import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as invoiceService from '../services/invoice.service.js';
import { buildInvoicePdf, buildReceiptPdf } from '../utils/pdf.js';

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  const { invoices, meta } = await invoiceService.listInvoices(req.validatedQuery ?? {});
  res.json({ success: true, data: { invoices, meta } });
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  res.json({ success: true, data: { invoice } });
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.createInvoice(req.body);
  res.status(201).json({ success: true, message: 'Invoice created', data: { invoice } });
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  res.json({ success: true, message: 'Invoice updated', data: { invoice } });
});

export const updateInvoiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.updateInvoiceStatus(req.params.id, req.body.status);
  res.json({ success: true, message: 'Invoice status updated', data: { invoice } });
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  await invoiceService.deleteInvoice(req.params.id);
  res.json({ success: true, message: 'Invoice deleted' });
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const { invoice } = await invoiceService.recordPayment(req.params.id, req.body);
  res.status(201).json({ success: true, message: 'Payment recorded', data: { invoice } });
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const payments = await invoiceService.listPayments(req.params.id);
  res.json({ success: true, data: { payments } });
});

export const downloadInvoicePdf = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  const doc = buildInvoicePdf(invoice);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);
  doc.end();
});

export const downloadReceiptPdf = asyncHandler(async (req: Request, res: Response) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  const index = Number(req.params.paymentIndex);
  const payment = invoice.payments[index];
  if (!Number.isInteger(index) || !payment) {
    throw ApiError.notFound('Payment not found on this invoice');
  }

  const doc = buildReceiptPdf(invoice, payment);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${invoice.invoiceNumber}-receipt-${index + 1}.pdf"`,
  );
  doc.pipe(res);
  doc.end();
});
