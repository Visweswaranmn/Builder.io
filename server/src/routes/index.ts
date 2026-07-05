import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import projectRoutes from './project.routes.js';
import employeeRoutes from './employee.routes.js';
import taskRoutes from './task.routes.js';
import materialRoutes from './material.routes.js';
import vendorRoutes from './vendor.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import expenseRoutes from './expense.routes.js';
import invoiceRoutes from './invoice.routes.js';
import notificationRoutes from './notification.routes.js';
import reportRoutes from './report.routes.js';
import dailyReportRoutes from './dailyReport.routes.js';
import userRoutes from './user.routes.js';

/**
 * Root API router. Each feature module (auth, projects, employees, ...) mounts
 * its own sub-router here as the phases are built out.
 */
const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/employees', employeeRoutes);
router.use('/tasks', taskRoutes);
router.use('/materials', materialRoutes);
router.use('/vendors', vendorRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/expenses', expenseRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reports', reportRoutes);
router.use('/daily-reports', dailyReportRoutes);
router.use('/users', userRoutes);

router.get('/', (_req, res) => {
  res.json({ success: true, message: 'CPMS API v1', docs: '/api/v1/health' });
});

export default router;
