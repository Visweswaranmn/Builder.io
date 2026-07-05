import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { createUserSchema, updateUserSchema, listUsersQuerySchema } from '../validators/user.validator.js';

const router = Router();

// User/account management (including role assignment) is a super-admin-only
// surface — unlike every other resource, there is no read access for other roles.
router.use(authenticate, authorize('super_admin'));

router.get('/', validateQuery(listUsersQuerySchema), userController.listUsers);
router.get('/:id', userController.getUser);
router.post('/', validateBody(createUserSchema), userController.createUser);
router.put('/:id', validateBody(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
