import type { UserRole } from './auth';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Ref {
  _id: string;
  name?: string;
}

// ---- Project ----
export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  _id: string;
  name: string;
  client: string;
  budget: number;
  startDate: string;
  endDate?: string;
  location?: string;
  status: ProjectStatus;
  description?: string;
  progress: number;
  manager?: Ref & { email?: string; role?: UserRole };
  createdAt: string;
}

// ---- Employee ----
export type Department = 'civil' | 'electrical' | 'plumbing' | 'management' | 'safety' | 'other';
export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface AttendanceEntry {
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}

export interface Employee {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  department: Department;
  designation?: string;
  salary: number;
  dateOfJoining?: string;
  isActive: boolean;
  user?: Ref;
  project?: Ref & { status?: ProjectStatus };
  manager?: Ref;
  attendance: AttendanceEntry[];
}

// ---- Task ----
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  _id: string;
  title: string;
  description?: string;
  project: Ref;
  assignedTo?: Ref & { department?: string; designation?: string };
  assignedBy?: Ref;
  priority: Priority;
  status: TaskStatus;
  progress: number;
  startDate?: string;
  deadline?: string;
  completedAt?: string;
  isOverdue?: boolean;
}

// ---- Material ----
export type MaterialCategory = 'cement' | 'steel' | 'sand' | 'bricks' | 'paint' | 'other';
export type StockTxnType = 'in' | 'out';

export interface StockTransaction {
  type: StockTxnType;
  quantity: number;
  date: string;
  note?: string;
  recordedBy?: string;
}

export interface Material {
  _id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  quantityInStock: number;
  lowStockThreshold: number;
  unitPrice: number;
  isLowStock: boolean;
  vendor?: Ref & { companyName?: string; phone?: string };
  project?: Ref;
  transactions: StockTransaction[];
}

// ---- Vendor ----
export type PaymentStatus = 'pending' | 'partial' | 'paid';
export type PurchaseOrderStatus = 'pending' | 'ordered' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'upi' | 'card' | 'other';

export interface PurchaseOrder {
  _id: string;
  orderNumber?: string;
  description: string;
  amount: number;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string;
  deliveredDate?: string;
}

export interface VendorPayment {
  amount: number;
  date: string;
  method: PaymentMethod;
  note?: string;
}

export interface Vendor {
  _id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  materialsSupplied: string[];
  outstandingBalance: number;
  paymentStatus: PaymentStatus;
  isActive: boolean;
  purchaseOrders: PurchaseOrder[];
  payments: VendorPayment[];
}

// ---- Expense ----
export type ExpenseCategory = 'material' | 'labour' | 'transport' | 'equipment' | 'utilities' | 'other';

export interface Expense {
  _id: string;
  project: Ref;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  date: string;
  vendor?: Ref;
  material?: Ref;
  paymentMethod?: PaymentMethod;
  recordedBy?: Ref;
}

// ---- Invoice ----
export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoicePayment {
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  project: Ref;
  client: string;
  items: InvoiceItem[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate?: string;
  payments: InvoicePayment[];
  amountPaid?: number;
  balanceDue?: number;
}

// ---- Notification ----
export type NotificationType =
  | 'material_low'
  | 'task_assigned'
  | 'deadline_reminder'
  | 'expense_limit'
  | 'general';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

// ---- App User (account/role management, super_admin only) ----
export interface AppUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

// ---- Daily Report ----
export interface Issue {
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
}

export interface DailyReport {
  _id: string;
  project: Ref & { status?: ProjectStatus };
  engineer: Ref & { email?: string; role?: UserRole };
  date: string;
  workDone?: string;
  progressPercentage: number;
  laborCount: number;
  weather?: string;
  images: string[];
  videos: string[];
  issues: Issue[];
}
