import { api } from '@/lib/axios';
import type { Expense, PaginationMeta, ExpenseCategory } from '@/types/models';

export interface ExpenseListParams {
  page?: number;
  limit?: number;
  project?: string;
  category?: ExpenseCategory;
  vendor?: string;
  from?: string;
  to?: string;
  search?: string;
}

export async function listExpenses(params: ExpenseListParams = {}) {
  const res = await api.get<{ data: { expenses: Expense[]; meta: PaginationMeta } }>('/expenses', { params });
  return res.data.data;
}

export async function getExpense(id: string) {
  const res = await api.get<{ data: { expense: Expense } }>(`/expenses/${id}`);
  return res.data.data.expense;
}

export async function createExpense(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { expense: Expense } }>('/expenses', payload);
  return res.data.data.expense;
}

export async function updateExpense(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { expense: Expense } }>(`/expenses/${id}`, payload);
  return res.data.data.expense;
}

export async function deleteExpense(id: string): Promise<void> {
  await api.delete(`/expenses/${id}`);
}
