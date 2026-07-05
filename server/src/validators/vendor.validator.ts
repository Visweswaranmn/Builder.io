import { z } from 'zod';
import { PAYMENT_STATUSES, PURCHASE_ORDER_STATUSES, PAYMENT_METHODS } from '../constants/enums.js';

export const createVendorSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  companyName: z.string().trim().max(150).optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  materialsSupplied: z.array(z.string().trim().max(60)).optional(),
});

export const updateVendorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().max(150).optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  phone: z.string().trim().max(20).optional(),
  address: z.string().trim().max(300).optional(),
  gstNumber: z.string().trim().max(20).optional(),
  materialsSupplied: z.array(z.string().trim().max(60)).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const listVendorsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});

export const createPurchaseOrderSchema = z.object({
  orderNumber: z.string().trim().max(60).optional(),
  description: z.string().trim().min(1, 'Description is required').max(300),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  expectedDeliveryDate: z.coerce.date().optional(),
});

export const updatePurchaseOrderStatusSchema = z.object({
  status: z.enum(PURCHASE_ORDER_STATUSES),
});

export const purchaseOrdersQuerySchema = z.object({
  status: z.enum(PURCHASE_ORDER_STATUSES).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.coerce.date().optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  note: z.string().trim().max(300).optional(),
});
