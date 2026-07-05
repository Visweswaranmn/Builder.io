import { Router } from 'express';
import * as expenseController from '../controllers/expense.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  expenseReportQuerySchema,
} from '../validators/expense.validator.js';

const router = Router();

// All expense routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

// Reports must be registered before '/:id' — otherwise Express would match
// e.g. "reports" as an :id param on the generic get-by-id route.
router.get(
  '/reports/by-category',
  validateQuery(expenseReportQuerySchema),
  expenseController.getCategorySummary,
);
router.get(
  '/reports/budget-vs-actual',
  validateQuery(expenseReportQuerySchema),
  expenseController.getBudgetVsActual,
);

router.get('/', validateQuery(listExpensesQuerySchema), expenseController.listExpenses);
router.get('/:id', expenseController.getExpense);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createExpenseSchema),
  expenseController.createExpense,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateExpenseSchema),
  expenseController.updateExpense,
);

router.delete('/:id', authorize('super_admin'), expenseController.deleteExpense);

export default router;
