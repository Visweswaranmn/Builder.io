import { FilterQuery, Types } from 'mongoose';
import { ProjectModel, type Project } from '../models/project.model.js';
import { EmployeeModel, type Employee } from '../models/employee.model.js';
import { TaskModel } from '../models/task.model.js';
import { MaterialModel, type Material } from '../models/material.model.js';
import { ExpenseModel, type Expense } from '../models/expense.model.js';
import type {
  ProjectStatus,
  ExpenseCategory,
  Department,
  MaterialCategory,
} from '../constants/enums.js';

// ---- Project report ----

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
  startDate: Date;
  endDate?: Date;
}

export async function getProjectsReport(filter: {
  status?: ProjectStatus;
  search?: string;
  from?: Date;
  to?: Date;
}): Promise<ProjectReportRow[]> {
  const match: FilterQuery<Project> = {};
  if (filter.status) match.status = filter.status;
  if (filter.search) match.name = new RegExp(filter.search.trim(), 'i');
  if (filter.from || filter.to) {
    match.startDate = {};
    if (filter.from) match.startDate.$gte = filter.from;
    if (filter.to) match.startDate.$lte = filter.to;
  }

  const projects = await ProjectModel.find(match).populate('manager', 'name').sort({ createdAt: -1 });
  const projectIds = projects.map((p) => p._id);

  const [expenseRows, employeeRows, taskRows] = await Promise.all([
    ExpenseModel.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$project', total: { $sum: '$amount' } } },
    ]),
    EmployeeModel.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { project: { $in: projectIds }, isActive: true } },
      { $group: { _id: '$project', count: { $sum: 1 } } },
    ]),
    TaskModel.aggregate<{ _id: { project: Types.ObjectId; status: string }; count: number }>([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: { project: '$project', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ]);

  const expenseMap = new Map(expenseRows.map((r) => [r._id.toString(), r.total]));
  const employeeMap = new Map(employeeRows.map((r) => [r._id.toString(), r.count]));
  const taskMap = new Map<string, Record<string, number>>();
  for (const row of taskRows) {
    const key = row._id.project.toString();
    if (!taskMap.has(key)) taskMap.set(key, {});
    taskMap.get(key)![row._id.status] = row.count;
  }

  return projects.map((p) => {
    const id = p._id.toString();
    const actualExpense = expenseMap.get(id) ?? 0;
    return {
      id,
      name: p.name,
      client: p.client,
      status: p.status as ProjectStatus,
      progress: p.progress ?? 0,
      budget: p.budget,
      actualExpense,
      variance: p.budget - actualExpense,
      managerName: (p.manager as unknown as { name?: string } | null)?.name,
      employeeCount: employeeMap.get(id) ?? 0,
      taskCounts: taskMap.get(id) ?? {},
      startDate: p.startDate,
      endDate: p.endDate ?? undefined,
    };
  });
}

// ---- Expense report ----

export interface ExpenseReportRow {
  id: string;
  date: Date;
  projectName?: string;
  category: ExpenseCategory;
  amount: number;
  description?: string;
  vendorName?: string;
  paymentMethod?: string;
  recordedByName?: string;
}

const EXPENSE_REPORT_ROW_LIMIT = 2000;

export async function getExpensesReport(filter: {
  project?: string;
  category?: ExpenseCategory;
  vendor?: string;
  from?: Date;
  to?: Date;
}): Promise<ExpenseReportRow[]> {
  const match: FilterQuery<Expense> = {};
  if (filter.project) match.project = filter.project;
  if (filter.category) match.category = filter.category;
  if (filter.vendor) match.vendor = filter.vendor;
  if (filter.from || filter.to) {
    match.date = {};
    if (filter.from) match.date.$gte = filter.from;
    if (filter.to) match.date.$lte = filter.to;
  }

  const expenses = await ExpenseModel.find(match)
    .populate('project', 'name')
    .populate('vendor', 'name')
    .populate('recordedBy', 'name')
    .sort({ date: -1 })
    .limit(EXPENSE_REPORT_ROW_LIMIT);

  return expenses.map((e) => ({
    id: e._id.toString(),
    date: e.date,
    projectName: (e.project as unknown as { name?: string } | null)?.name,
    category: e.category as ExpenseCategory,
    amount: e.amount,
    description: e.description ?? undefined,
    vendorName: (e.vendor as unknown as { name?: string } | null)?.name,
    paymentMethod: e.paymentMethod ?? undefined,
    recordedByName: (e.recordedBy as unknown as { name?: string } | null)?.name,
  }));
}

// ---- Employee report ----

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

export async function getEmployeesReport(filter: {
  project?: string;
  department?: Department;
  isActive?: boolean;
  from?: Date;
  to?: Date;
}): Promise<EmployeeReportRow[]> {
  const match: FilterQuery<Employee> = {};
  if (filter.project) match.project = filter.project;
  if (filter.department) match.department = filter.department;
  if (filter.isActive !== undefined) match.isActive = filter.isActive;

  const employees = await EmployeeModel.find(match).populate('project', 'name').sort({ name: 1 });

  return employees.map((e) => {
    const attendance = e.attendance.filter(
      (a) => (!filter.from || a.date >= filter.from) && (!filter.to || a.date <= filter.to),
    );
    const counts = { present: 0, absent: 0, halfDay: 0, leave: 0 };
    for (const a of attendance) {
      if (a.status === 'present') counts.present += 1;
      else if (a.status === 'absent') counts.absent += 1;
      else if (a.status === 'half_day') counts.halfDay += 1;
      else if (a.status === 'leave') counts.leave += 1;
    }

    return {
      id: e._id.toString(),
      name: e.name,
      department: e.department as Department,
      designation: e.designation ?? undefined,
      projectName: (e.project as unknown as { name?: string } | null)?.name,
      salary: e.salary ?? 0,
      isActive: e.isActive ?? true,
      ...counts,
    };
  });
}

// ---- Material report ----

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

export async function getMaterialsReport(filter: {
  project?: string;
  category?: MaterialCategory;
  lowStockOnly?: boolean;
  from?: Date;
  to?: Date;
}): Promise<MaterialReportRow[]> {
  const match: FilterQuery<Material> = {};
  if (filter.project) match.project = filter.project;
  if (filter.category) match.category = filter.category;
  if (filter.lowStockOnly) {
    match.$expr = { $lte: ['$quantityInStock', '$lowStockThreshold'] };
  }

  const materials = await MaterialModel.find(match)
    .populate('vendor', 'name')
    .populate('project', 'name')
    .sort({ name: 1 });

  return materials.map((m) => {
    const transactions = m.transactions.filter(
      (t) => (!filter.from || t.date >= filter.from) && (!filter.to || t.date <= filter.to),
    );
    const totalStockIn = transactions.filter((t) => t.type === 'in').reduce((sum, t) => sum + t.quantity, 0);
    const totalStockOut = transactions.filter((t) => t.type === 'out').reduce((sum, t) => sum + t.quantity, 0);
    const quantityInStock = m.quantityInStock ?? 0;
    const lowStockThreshold = m.lowStockThreshold ?? 0;
    const unitPrice = m.unitPrice ?? 0;

    return {
      id: m._id.toString(),
      name: m.name,
      category: m.category as MaterialCategory,
      unit: m.unit,
      quantityInStock,
      lowStockThreshold,
      isLowStock: quantityInStock <= lowStockThreshold,
      unitPrice,
      stockValue: quantityInStock * unitPrice,
      totalStockIn,
      totalStockOut,
      vendorName: (m.vendor as unknown as { name?: string } | null)?.name,
      projectName: (m.project as unknown as { name?: string } | null)?.name,
    };
  });
}
