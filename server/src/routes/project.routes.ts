import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
} from '../validators/project.validator.js';

const router = Router();

// All project routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listProjectsQuerySchema), projectController.listProjects);
router.get('/:id', projectController.getProject);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createProjectSchema),
  projectController.createProject,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateProjectSchema),
  projectController.updateProject,
);

router.delete('/:id', authorize('super_admin'), projectController.deleteProject);

export default router;
