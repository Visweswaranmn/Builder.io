import { Router } from 'express';
import * as reportController from '../controllers/report.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import {
  projectsReportQuerySchema,
  expensesReportQuerySchema,
  employeesReportQuerySchema,
  materialsReportQuerySchema,
} from '../validators/report.validator.js';

const router = Router();

// Reports are read-only analytics — every authenticated role may view/export them.
router.use(authenticate);

router.get('/projects', validateQuery(projectsReportQuerySchema), reportController.getProjectsReport);
router.get('/expenses', validateQuery(expensesReportQuerySchema), reportController.getExpensesReport);
router.get('/employees', validateQuery(employeesReportQuerySchema), reportController.getEmployeesReport);
router.get('/materials', validateQuery(materialsReportQuerySchema), reportController.getMaterialsReport);

export default router;
