import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { INVOICE_STATUSES, PAYMENT_METHODS } from '../constants/enums.js';

/** A single billed line item. */
const invoiceItemSchema = new Schema(
  {
    description: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 }, // quantity * unitPrice
  },
  { _id: false },
);

/** A recorded payment received against an invoice. */
const paymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    method: { type: String, enum: PAYMENT_METHODS, default: 'bank_transfer' },
    reference: { type: String, trim: true },
  },
  { _id: false },
);

/**
 * A client invoice with GST, line items, and a payment history. `balanceDue`
 * is derived from total minus recorded payments.
 */
const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    client: { type: String, required: true, trim: true },

    items: { type: [invoiceItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    gstRate: { type: Number, min: 0, max: 100, default: 18 },
    gstAmount: { type: Number, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0, default: 0 },

    status: { type: String, enum: INVOICE_STATUSES, default: 'draft', index: true },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    payments: { type: [paymentSchema], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

invoiceSchema.virtual('amountPaid').get(function () {
  return this.payments.reduce((sum, p) => sum + p.amount, 0);
});

invoiceSchema.virtual('balanceDue').get(function () {
  const paid = this.payments.reduce((sum, p) => sum + p.amount, 0);
  return Math.max(this.total - paid, 0);
});

export type Invoice = InferSchemaType<typeof invoiceSchema>;
export type InvoiceDocument = HydratedDocument<Invoice>;

export const InvoiceModel = model('Invoice', invoiceSchema);
