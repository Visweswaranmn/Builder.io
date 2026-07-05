import { z } from 'zod';
import { MATERIAL_CATEGORIES, STOCK_TXN_TYPES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

export const createMaterialSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  quantityInStock: z.coerce.number().min(0).optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  vendor: objectId.optional(),
  project: objectId.optional(),
});

/**
 * `quantityInStock` is intentionally NOT editable here — it only changes via
 * the stock-transaction endpoint, so the embedded ledger stays the single
 * source of truth for every quantity change.
 */
export const updateMaterialSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  unit: z.string().trim().min(1).max(30).optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  vendor: objectId.optional(),
  project: objectId.optional(),
});

export const listMaterialsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  project: objectId.optional(),
  vendor: objectId.optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});

export const stockTransactionSchema = z.object({
  type: z.enum(STOCK_TXN_TYPES),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  date: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});

export const transactionsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
