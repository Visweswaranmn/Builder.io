import { FilterQuery, Types } from 'mongoose';
import { InvoiceModel, type Invoice, type InvoiceDocument } from '../models/invoice.model.js';
import { ProjectModel } from '../models/project.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { InvoiceStatus, PaymentMethod } from '../constants/enums.js';

interface ListInvoicesInput {
  page?: number;
  limit?: number;
  project?: string;
  status?: InvoiceStatus;
  client?: string;
  outstandingOnly?: boolean;
  from?: Date;
  to?: Date;
}

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

const POPULATE_FIELDS = [{ path: 'project', select: 'name status client' }];
const MANUALLY_SETTABLE_STATUSES: InvoiceStatus[] = ['sent', 'cancelled'];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

/** Recomputes each line item's amount and the invoice-level subtotal/GST/total. */
function computeTotals(
  items: InvoiceItemInput[],
  gstRate: number,
): { items: (InvoiceItemInput & { amount: number })[]; subtotal: number; gstAmount: number; total: number } {
  const computedItems = items.map((item) => ({
    ...item,
    amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
  }));
  const subtotal = Math.round(computedItems.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const total = Math.round((subtotal + gstAmount) * 100) / 100;
  return { items: computedItems, subtotal, gstAmount, total };
}

/**
 * Derives the financial state (paid/partially_paid/overdue) from the current
 * balance and due date. Never overrides a manually-set draft/sent/cancelled
 * state unless the numbers say otherwise — e.g. a "sent" invoice becomes
 * "overdue" once its due date passes, and "paid" once fully settled.
 */
function syncStatus(invoice: InvoiceDocument): void {
  if (invoice.status === 'cancelled') return;

  const amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(invoice.total - amountPaid, 0);

  if (invoice.total > 0 && balanceDue <= 0) {
    invoice.status = 'paid';
  } else if (invoice.dueDate && invoice.dueDate < new Date() && balanceDue > 0) {
    invoice.status = 'overdue';
  } else if (amountPaid > 0) {
    invoice.status = 'partially_paid';
  }
}

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await InvoiceModel.countDocuments({
    invoiceNumber: new RegExp(`^INV-${year}-`),
  });
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

export async function listInvoices(
  input: ListInvoicesInput,
): Promise<{ invoices: InvoiceDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Invoice> = {};
  if (input.project) filter.project = input.project;
  if (input.status) filter.status = input.status;
  if (input.client) filter.client = new RegExp(input.client.trim(), 'i');
  if (input.from || input.to) {
    filter.issueDate = {};
    if (input.from) filter.issueDate.$gte = input.from;
    if (input.to) filter.issueDate.$lte = input.to;
  }
  // amountPaid/balanceDue are virtuals, not stored fields — $expr lets us
  // compare against an aggregation expression ($sum over the payments array).
  if (input.outstandingOnly) {
    filter.$expr = { $lt: [{ $sum: '$payments.amount' }, '$total'] };
    filter.status = filter.status ?? { $ne: 'cancelled' };
  }

  const [invoices, total] = await Promise.all([
    InvoiceModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    InvoiceModel.countDocuments(filter),
  ]);

  return { invoices, meta: buildPaginationMeta(pagination, total) };
}

export async function getInvoiceById(id: string): Promise<InvoiceDocument> {
  const invoice = await InvoiceModel.findById(id).populate(POPULATE_FIELDS);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return invoice;
}

export async function createInvoice(input: {
  invoiceNumber?: string;
  project: string;
  client: string;
  items: InvoiceItemInput[];
  gstRate?: number;
  issueDate?: Date;
  dueDate?: Date;
}): Promise<InvoiceDocument> {
  await assertProjectExists(input.project);

  const gstRate = input.gstRate ?? 18;
  const totals = computeTotals(input.items, gstRate);

  // Auto-generated numbers are retried on a rare race with another concurrent
  // creation; an explicitly supplied number is never retried — a genuine
  // duplicate there should surface as a normal 409, not be silently changed.
  const attempts = input.invoiceNumber ? 1 : 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const invoiceNumber = input.invoiceNumber ?? (await generateInvoiceNumber());
    try {
      const invoice = await InvoiceModel.create({
        invoiceNumber,
        project: input.project,
        client: input.client,
        items: totals.items,
        subtotal: totals.subtotal,
        gstRate,
        gstAmount: totals.gstAmount,
        total: totals.total,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
      });
      return invoice.populate(POPULATE_FIELDS);
    } catch (err) {
      lastError = err;
      const isDuplicateKey =
        typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
      if (!isDuplicateKey) throw err;
      if (input.invoiceNumber) {
        throw ApiError.conflict(`Invoice number "${input.invoiceNumber}" is already in use`);
      }
      // else: loop and regenerate a fresh auto number
    }
  }
  throw lastError;
}

export async function updateInvoice(
  id: string,
  input: {
    project?: string;
    client?: string;
    items?: InvoiceItemInput[];
    gstRate?: number;
    issueDate?: Date;
    dueDate?: Date;
  },
): Promise<InvoiceDocument> {
  await assertProjectExists(input.project);

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  if (input.project !== undefined) invoice.project = new Types.ObjectId(input.project);
  if (input.client !== undefined) invoice.client = input.client;
  if (input.issueDate !== undefined) invoice.issueDate = input.issueDate;
  if (input.dueDate !== undefined) invoice.dueDate = input.dueDate;

  if (input.items !== undefined || input.gstRate !== undefined) {
    const gstRate = input.gstRate ?? invoice.gstRate ?? 18;
    const items = input.items ?? invoice.items;
    const totals = computeTotals(items, gstRate);
    invoice.items = totals.items as typeof invoice.items;
    invoice.subtotal = totals.subtotal;
    invoice.gstRate = gstRate;
    invoice.gstAmount = totals.gstAmount;
    invoice.total = totals.total;
  }

  syncStatus(invoice);
  await invoice.save();

  return invoice.populate(POPULATE_FIELDS);
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<InvoiceDocument> {
  if (!MANUALLY_SETTABLE_STATUSES.includes(status)) {
    throw ApiError.badRequest(`Status "${status}" cannot be set manually`);
  }

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');

  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('Cannot change the status of a cancelled invoice');
  }
  if (invoice.status === 'paid' && status === 'sent') {
    throw ApiError.badRequest('Cannot revert a paid invoice back to sent');
  }

  invoice.status = status;
  await invoice.save();

  return invoice.populate(POPULATE_FIELDS);
}

export async function deleteInvoice(id: string): Promise<void> {
  const invoice = await InvoiceModel.findByIdAndDelete(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
}

export async function recordPayment(
  id: string,
  input: { amount: number; date?: Date; method?: PaymentMethod; reference?: string },
): Promise<{ invoice: InvoiceDocument; paymentIndex: number }> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.status === 'cancelled') {
    throw ApiError.badRequest('Cannot record a payment against a cancelled invoice');
  }

  const amountPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = invoice.total - amountPaid;
  if (input.amount > balanceDue) {
    throw ApiError.badRequest(`Payment exceeds the outstanding balance of ${balanceDue}`);
  }

  invoice.payments.push(input);
  syncStatus(invoice);
  await invoice.save();

  return { invoice: await invoice.populate(POPULATE_FIELDS), paymentIndex: invoice.payments.length - 1 };
}

export type InvoicePayment = Invoice['payments'][number];

export async function listPayments(id: string): Promise<InvoicePayment[]> {
  const invoice = await InvoiceModel.findById(id);
  if (!invoice) throw ApiError.notFound('Invoice not found');
  return [...invoice.payments].sort((a, b) => b.date.getTime() - a.date.getTime());
}
