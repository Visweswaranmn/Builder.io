import { z } from 'zod';
import { PAYMENT_METHODS } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

/**
 * `amount` is deliberately NOT accepted here — it's always recomputed
 * server-side as `quantity * unitPrice` so a client can't submit a mismatched
 * total on a line item.
 */
const invoiceItemSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(300),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(40).optional(),
  project: objectId,
  client: z.string().trim().min(1, 'Client is required').max(150),
  items: z.array(invoiceItemSchema).min(1, 'At least one line item is required'),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

/**
 * `invoiceNumber`, `status`, and `payments` are intentionally excluded —
 * the invoice number is immutable once created, status changes go through
 * the dedicated status endpoint, and payments through the payment endpoint.
 */
export const updateInvoiceSchema = z.object({
  project: objectId.optional(),
  client: z.string().trim().min(1).max(150).optional(),
  items: z.array(invoiceItemSchema).min(1).optional(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
  issueDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

/**
 * Only "sent" and "cancelled" are manually settable — "paid"/"partially_paid"/
 * "overdue" are derived automatically from payments and the due date.
 */
export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['sent', 'cancelled']),
});

export const recordInvoicePaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.coerce.date().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  reference: z.string().trim().max(100).optional(),
});

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  project: objectId.optional(),
  status: z.enum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']).optional(),
  client: z.string().trim().max(150).optional(),
  outstandingOnly: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
