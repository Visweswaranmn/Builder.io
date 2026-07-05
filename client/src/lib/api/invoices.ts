import { api } from '@/lib/axios';
import type { Invoice, PaginationMeta, InvoiceStatus, PaymentMethod } from '@/types/models';

export interface InvoiceListParams {
  page?: number;
  limit?: number;
  project?: string;
  status?: InvoiceStatus;
  client?: string;
  outstandingOnly?: boolean;
}

export async function listInvoices(params: InvoiceListParams = {}) {
  const res = await api.get<{ data: { invoices: Invoice[]; meta: PaginationMeta } }>('/invoices', { params });
  return res.data.data;
}

export async function getInvoice(id: string) {
  const res = await api.get<{ data: { invoice: Invoice } }>(`/invoices/${id}`);
  return res.data.data.invoice;
}

export async function createInvoice(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { invoice: Invoice } }>('/invoices', payload);
  return res.data.data.invoice;
}

export async function updateInvoice(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { invoice: Invoice } }>(`/invoices/${id}`, payload);
  return res.data.data.invoice;
}

export async function deleteInvoice(id: string): Promise<void> {
  await api.delete(`/invoices/${id}`);
}

export async function updateInvoiceStatus(id: string, status: 'sent' | 'cancelled') {
  const res = await api.patch<{ data: { invoice: Invoice } }>(`/invoices/${id}/status`, { status });
  return res.data.data.invoice;
}

export async function recordInvoicePayment(
  id: string,
  payload: { amount: number; method?: PaymentMethod; reference?: string },
) {
  const res = await api.post<{ data: { invoice: Invoice } }>(`/invoices/${id}/payments`, payload);
  return res.data.data.invoice;
}

function downloadBlobResponse(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadInvoicePdf(id: string, invoiceNumber: string): Promise<void> {
  const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
  downloadBlobResponse(res.data as Blob, `${invoiceNumber}.pdf`);
}

export async function downloadReceiptPdf(id: string, paymentIndex: number, invoiceNumber: string): Promise<void> {
  const res = await api.get(`/invoices/${id}/payments/${paymentIndex}/receipt`, { responseType: 'blob' });
  downloadBlobResponse(res.data as Blob, `${invoiceNumber}-receipt-${paymentIndex + 1}.pdf`);
}
