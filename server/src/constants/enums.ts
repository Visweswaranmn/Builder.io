/**
 * Centralized enums / constant unions used across models, validators, and
 * controllers. Declared `as const` so each yields a precise string-literal type.
 */

export const USER_ROLES = ['super_admin', 'project_manager', 'site_engineer', 'accountant'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_STATUSES = [
  'planning',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const DEPARTMENTS = [
  'civil',
  'electrical',
  'plumbing',
  'management',
  'safety',
  'other',
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'leave'] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const MATERIAL_CATEGORIES = [
  'cement',
  'steel',
  'sand',
  'bricks',
  'paint',
  'other',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const STOCK_TXN_TYPES = ['in', 'out'] as const;
export type StockTxnType = (typeof STOCK_TXN_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  'material',
  'labour',
  'transport',
  'equipment',
  'utilities',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Vendor / purchase-order settlement state. */
export const PAYMENT_STATUSES = ['pending', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PURCHASE_ORDER_STATUSES = ['pending', 'ordered', 'delivered', 'cancelled'] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'material_low',
  'task_assigned',
  'deadline_reminder',
  'expense_limit',
  'general',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
