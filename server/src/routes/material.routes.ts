import { Router } from 'express';
import * as materialController from '../controllers/material.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createMaterialSchema,
  updateMaterialSchema,
  listMaterialsQuerySchema,
  stockTransactionSchema,
  transactionsQuerySchema,
} from '../validators/material.validator.js';

const router = Router();

// All material routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listMaterialsQuerySchema), materialController.listMaterials);
router.get('/:id', materialController.getMaterial);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createMaterialSchema),
  materialController.createMaterial,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateMaterialSchema),
  materialController.updateMaterial,
);

router.delete('/:id', authorize('super_admin'), materialController.deleteMaterial);

router.get(
  '/:id/transactions',
  validateQuery(transactionsQuerySchema),
  materialController.getTransactions,
);

// Site engineers physically handle stock movements on site, so they (along
// with managers/admins) may record stock in/out — but not edit or delete the
// material definition itself.
router.post(
  '/:id/stock',
  authorize('super_admin', 'project_manager', 'site_engineer'),
  validateBody(stockTransactionSchema),
  materialController.addStockTransaction,
);

export default router;
