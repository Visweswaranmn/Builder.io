import { FilterQuery, Types } from 'mongoose';
import { ExpenseModel, type Expense, type ExpenseDocument } from '../models/expense.model.js';
import { ProjectModel } from '../models/project.model.js';
import { VendorModel } from '../models/vendor.model.js';
import { MaterialModel } from '../models/material.model.js';
import { ApiError } from '../utils/ApiError.js';
import { parsePagination, buildPaginationMeta, type PaginationMeta } from '../utils/pagination.js';
import type { ExpenseCategory } from '../constants/enums.js';
import { notifyExpenseLimit } from './notification.service.js';

interface ListExpensesInput {
  page?: number;
  limit?: number;
  project?: string;
  category?: ExpenseCategory;
  vendor?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

const POPULATE_FIELDS = [
  { path: 'project', select: 'name status budget' },
  { path: 'vendor', select: 'name companyName' },
  { path: 'material', select: 'name unit' },
  { path: 'recordedBy', select: 'name email role' },
];

async function assertProjectExists(projectId: string | undefined): Promise<void> {
  if (!projectId) return;
  const exists = await ProjectModel.exists({ _id: projectId });
  if (!exists) throw ApiError.badRequest('project does not reference an existing project');
}

async function assertVendorExists(vendorId: string | undefined): Promise<void> {
  if (!vendorId) return;
  const exists = await VendorModel.exists({ _id: vendorId });
  if (!exists) throw ApiError.badRequest('vendor does not reference an existing vendor');
}

async function assertMaterialExists(materialId: string | undefined): Promise<void> {
  if (!materialId) return;
  const exists = await MaterialModel.exists({ _id: materialId });
  if (!exists) throw ApiError.badRequest('material does not reference an existing material');
}

export async function listExpenses(
  input: ListExpensesInput,
): Promise<{ expenses: ExpenseDocument[]; meta: PaginationMeta }> {
  const pagination = parsePagination(input);

  const filter: FilterQuery<Expense> = {};
  if (input.project) filter.project = input.project;
  if (input.category) filter.category = input.category;
  if (input.vendor) filter.vendor = input.vendor;
  if (input.from || input.to) {
    filter.date = {};
    if (input.from) filter.date.$gte = input.from;
    if (input.to) filter.date.$lte = input.to;
  }
  if (input.search) filter.description = new RegExp(input.search.trim(), 'i');

  const [expenses, total] = await Promise.all([
    ExpenseModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ date: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    ExpenseModel.countDocuments(filter),
  ]);

  return { expenses, meta: buildPaginationMeta(pagination, total) };
}

export async function getExpenseById(id: string): Promise<ExpenseDocument> {
  const expense = await ExpenseModel.findById(id).populate(POPULATE_FIELDS);
  if (!expense) throw ApiError.notFound('Expense not found');
  return expense;
}

export async function createExpense(
  input: Partial<Expense>,
  recordedBy: string,
): Promise<ExpenseDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertVendorExists(input.vendor?.toString()),
    assertMaterialExists(input.material?.toString()),
  ]);

  // Spend-so-far, checked BEFORE this expense is recorded, so the alert only
  // fires once — on the expense that actually pushes the project over budget,
  // not on every subsequent expense while it stays over.
  const project = input.project ? await ProjectModel.findById(input.project) : null;
  let previousSpend = 0;
  if (project) {
    const [{ total } = { total: 0 }] = await ExpenseModel.aggregate<{ total: number }>([
      { $match: { project: project._id } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    previousSpend = total;
  }

  const expense = await ExpenseModel.create({ ...input, recordedBy });

  if (project && input.amount) {
    const newTotal = previousSpend + input.amount;
    if (previousSpend <= project.budget && newTotal > project.budget) {
      await notifyExpenseLimit(project, newTotal);
    }
  }

  return expense.populate(POPULATE_FIELDS);
}

export async function updateExpense(
  id: string,
  input: Partial<Expense>,
): Promise<ExpenseDocument> {
  await Promise.all([
    assertProjectExists(input.project?.toString()),
    assertVendorExists(input.vendor?.toString()),
    assertMaterialExists(input.material?.toString()),
  ]);

  const expense = await ExpenseModel.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found');

  Object.assign(expense, input);
  await expense.save();

  return expense.populate(POPULATE_FIELDS);
}

export async function deleteExpense(id: string): Promise<void> {
  const expense = await ExpenseModel.findByIdAndDelete(id);
  if (!expense) throw ApiError.notFound('Expense not found');
}

interface ReportFilter {
  project?: string;
  from?: Date;
  to?: Date;
}

function dateMatch(filter: ReportFilter): Record<string, unknown> {
  const match: Record<string, unknown> = {};
  // Aggregation pipelines don't auto-cast query values like Mongoose's query
  // methods do, so the string project id must be cast to ObjectId explicitly.
  if (filter.project) match.project = new Types.ObjectId(filter.project);
  if (filter.from || filter.to) {
    const date: Record<string, Date> = {};
    if (filter.from) date.$gte = filter.from;
    if (filter.to) date.$lte = filter.to;
    match.date = date;
  }
  return match;
}

/** Total spend + a per-category breakdown, optionally scoped to a project/date range. */
export async function getCategorySummary(
  filter: ReportFilter,
): Promise<{ total: number; byCategory: { category: ExpenseCategory; total: number; count: number }[] }> {
  const rows = await ExpenseModel.aggregate<{ _id: ExpenseCategory; total: number; count: number }>([
    { $match: dateMatch(filter) },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
  ]);

  return {
    total: rows.reduce((sum, r) => sum + r.total, 0),
    byCategory: rows.map((r) => ({ category: r._id, total: r.total, count: r.count })),
  };
}

interface BudgetVsActualRow {
  projectId: string;
  projectName: string;
  budget: number;
  actual: number;
  variance: number;
  percentUsed: number;
}

/** Compares each project's budget against its actual recorded spend. */
export async function getBudgetVsActual(filter: { project?: string }): Promise<BudgetVsActualRow[]> {
  const rows = await ProjectModel.aggregate<{
    _id: unknown;
    name: string;
    budget: number;
    actual: number;
  }>([
    ...(filter.project ? [{ $match: { _id: new Types.ObjectId(filter.project) } }] : []),
    {
      $lookup: {
        from: 'expenses',
        localField: '_id',
        foreignField: 'project',
        as: 'expenses',
      },
    },
    {
      $project: {
        name: 1,
        budget: 1,
        actual: { $sum: '$expenses.amount' },
      },
    },
  ]);

  return rows.map((r) => ({
    projectId: r._id!.toString(),
    projectName: r.name,
    budget: r.budget,
    actual: r.actual,
    variance: r.budget - r.actual,
    percentUsed: r.budget > 0 ? Math.round((r.actual / r.budget) * 1000) / 10 : 0,
  }));
}
