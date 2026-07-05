import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as expenseService from '../services/expense.service.js';

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const { expenses, meta } = await expenseService.listExpenses(req.validatedQuery ?? {});
  res.json({ success: true, data: { expenses, meta } });
});

export const getExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await expenseService.getExpenseById(req.params.id);
  res.json({ success: true, data: { expense } });
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const expense = await expenseService.createExpense(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Expense recorded', data: { expense } });
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await expenseService.updateExpense(req.params.id, req.body);
  res.json({ success: true, message: 'Expense updated', data: { expense } });
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  await expenseService.deleteExpense(req.params.id);
  res.json({ success: true, message: 'Expense deleted' });
});

export const getCategorySummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await expenseService.getCategorySummary(req.validatedQuery ?? {});
  res.json({ success: true, data: summary });
});

export const getBudgetVsActual = asyncHandler(async (req: Request, res: Response) => {
  const rows = await expenseService.getBudgetVsActual(req.validatedQuery ?? {});
  res.json({ success: true, data: { projects: rows } });
});
