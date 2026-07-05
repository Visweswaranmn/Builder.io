import { z } from 'zod';
import { PROJECT_STATUSES, EXPENSE_CATEGORIES, DEPARTMENTS, MATERIAL_CATEGORIES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');
const format = z.enum(['json', 'csv', 'excel', 'pdf']).optional();

export const projectsReportQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  search: z.string().trim().max(150).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format,
});

export const expensesReportQuerySchema = z.object({
  project: objectId.optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  vendor: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format,
});

export const employeesReportQuerySchema = z.object({
  project: objectId.optional(),
  department: z.enum(DEPARTMENTS).optional(),
  isActive: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format,
});

export const materialsReportQuerySchema = z.object({
  project: objectId.optional(),
  category: z.enum(MATERIAL_CATEGORIES).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format,
});
