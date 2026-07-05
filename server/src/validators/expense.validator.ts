import { z } from 'zod';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

export const createExpenseSchema = z.object({
  project: objectId,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  description: z.string().trim().max(500).optional(),
  date: z.coerce.date().optional(),
  vendor: objectId.optional(),
  material: objectId.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  receiptUrl: z.string().trim().url('Must be a valid URL').optional(),
});

export const updateExpenseSchema = z.object({
  project: objectId.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  amount: z.coerce.number().positive().optional(),
  description: z.string().trim().max(500).optional(),
  date: z.coerce.date().optional(),
  vendor: objectId.optional(),
  material: objectId.optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  receiptUrl: z.string().trim().url('Must be a valid URL').optional(),
});

export const listExpensesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  project: objectId.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  vendor: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().trim().max(200).optional(),
});

export const expenseReportQuerySchema = z.object({
  project: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
