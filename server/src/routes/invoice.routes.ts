import { Router } from 'express';
import * as invoiceController from '../controllers/invoice.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  recordInvoicePaymentSchema,
  listInvoicesQuerySchema,
} from '../validators/invoice.validator.js';

const router = Router();

// All invoice routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listInvoicesQuerySchema), invoiceController.listInvoices);
router.get('/:id', invoiceController.getInvoice);
router.get('/:id/pdf', invoiceController.downloadInvoicePdf);
router.get('/:id/payments', invoiceController.listPayments);
router.get('/:id/payments/:paymentIndex/receipt', invoiceController.downloadReceiptPdf);

router.post(
  '/',
  authorize('super_admin'),
  validateBody(createInvoiceSchema),
  invoiceController.createInvoice,
);

router.put(
  '/:id',
  authorize('super_admin'),
  validateBody(updateInvoiceSchema),
  invoiceController.updateInvoice,
);

router.patch(
  '/:id/status',
  authorize('super_admin'),
  validateBody(updateInvoiceStatusSchema),
  invoiceController.updateInvoiceStatus,
);

router.post(
  '/:id/payments',
  authorize('super_admin'),
  validateBody(recordInvoicePaymentSchema),
  invoiceController.recordPayment,
);

router.delete('/:id', authorize('super_admin'), invoiceController.deleteInvoice);

export default router;
