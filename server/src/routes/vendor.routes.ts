import { Router } from 'express';
import * as vendorController from '../controllers/vendor.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createVendorSchema,
  updateVendorSchema,
  listVendorsQuerySchema,
  createPurchaseOrderSchema,
  updatePurchaseOrderStatusSchema,
  purchaseOrdersQuerySchema,
  recordPaymentSchema,
} from '../validators/vendor.validator.js';

const router = Router();

// All vendor routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listVendorsQuerySchema), vendorController.listVendors);
router.get('/:id', vendorController.getVendor);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createVendorSchema),
  vendorController.createVendor,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateVendorSchema),
  vendorController.updateVendor,
);

router.delete('/:id', authorize('super_admin'), vendorController.deleteVendor);

router.get(
  '/:id/purchase-orders',
  validateQuery(purchaseOrdersQuerySchema),
  vendorController.listPurchaseOrders,
);

router.post(
  '/:id/purchase-orders',
  authorize('super_admin'),
  validateBody(createPurchaseOrderSchema),
  vendorController.addPurchaseOrder,
);

router.patch(
  '/:id/purchase-orders/:poId',
  authorize('super_admin'),
  validateBody(updatePurchaseOrderStatusSchema),
  vendorController.updatePurchaseOrderStatus,
);

router.get('/:id/payments', vendorController.listPayments);

// Vendor/finance write access is now super-admin only, same as every other
// resource — the accountant role is read-only like everyone but super_admin.
router.post(
  '/:id/payments',
  authorize('super_admin'),
  validateBody(recordPaymentSchema),
  vendorController.recordPayment,
);

export default router;
