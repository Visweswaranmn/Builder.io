import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../constants/enums.js';

/**
 * A recorded cost against a project — the raw data behind budget-vs-actual and
 * finance reports (Phase 11).
 */
const expenseSchema = new Schema(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    date: { type: Date, default: Date.now, index: true },

    vendor: { type: Schema.Types.ObjectId, ref: 'Vendor' },
    material: { type: Schema.Types.ObjectId, ref: 'Material' },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: 'cash' },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    receiptUrl: { type: String },
  },
  { timestamps: true },
);

// Common analytics access pattern: expenses of a project over time.
expenseSchema.index({ project: 1, date: -1 });

export type Expense = InferSchemaType<typeof expenseSchema>;
export type ExpenseDocument = HydratedDocument<Expense>;

export const ExpenseModel = model('Expense', expenseSchema);
