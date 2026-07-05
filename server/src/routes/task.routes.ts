import { Router } from 'express';
import * as taskController from '../controllers/task.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateProgressSchema,
  listTasksQuerySchema,
} from '../validators/task.validator.js';

const router = Router();

// All task routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listTasksQuerySchema), taskController.listTasks);
router.get('/:id', taskController.getTask);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createTaskSchema),
  taskController.createTask,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateTaskSchema),
  taskController.updateTask,
);

router.delete('/:id', authorize('super_admin'), taskController.deleteTask);

// Open to any authenticated role — ownership is enforced in the service layer
// (managers can always update; anyone else only their own assigned task).
router.patch(
  '/:id/progress',
  validateBody(updateProgressSchema),
  taskController.updateTaskProgress,
);

export default router;
