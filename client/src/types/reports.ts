import type { ProjectStatus, ExpenseCategory, Department, MaterialCategory } from './models';

export interface ProjectReportRow {
  id: string;
  name: string;
  client: string;
  status: ProjectStatus;
  progress: number;
  budget: number;
  actualExpense: number;
  variance: number;
  managerName?: string;
  employeeCount: number;
  taskCounts: Record<string, number>;
  startDate: string;
  endDate?: string;
}

export interface ExpenseReportRow {
  id: string;
  date: string;
  projectName?: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  vendorName?: string;
  paymentMethod?: string;
  recordedByName?: string;
}

export interface ExpenseReportSummary {
  total: number;
  byCategory: { category: ExpenseCategory; total: number; count: number }[];
}

export interface EmployeeReportRow {
  id: string;
  name: string;
  department: Department;
  designation?: string;
  projectName?: string;
  salary: number;
  isActive: boolean;
  present: number;
  absent: number;
  halfDay: number;
  leave: number;
}

export interface MaterialReportRow {
  id: string;
  name: string;
  category: MaterialCategory;
  unit: string;
  quantityInStock: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  unitPrice: number;
  stockValue: number;
  totalStockIn: number;
  totalStockOut: number;
  vendorName?: string;
  projectName?: string;
}
