import { Router } from 'express';
import * as employeeController from '../controllers/employee.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
  markAttendanceSchema,
  attendanceQuerySchema,
} from '../validators/employee.validator.js';

const router = Router();

// All employee routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listEmployeesQuerySchema), employeeController.listEmployees);
router.get('/:id', employeeController.getEmployee);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createEmployeeSchema),
  employeeController.createEmployee,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateEmployeeSchema),
  employeeController.updateEmployee,
);

router.delete('/:id', authorize('super_admin'), employeeController.deleteEmployee);

router.get(
  '/:id/attendance',
  validateQuery(attendanceQuerySchema),
  employeeController.getAttendance,
);

router.post(
  '/:id/attendance',
  authorize('super_admin', 'project_manager'),
  validateBody(markAttendanceSchema),
  employeeController.markAttendance,
);

export default router;
