import { Router } from 'express';
import * as dailyReportController from '../controllers/dailyReport.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { handleDailyReportUpload } from '../middleware/upload.js';
import {
  createDailyReportSchema,
  updateDailyReportSchema,
  listDailyReportsQuerySchema,
  addIssueSchema,
  updateIssueSchema,
} from '../validators/dailyReport.validator.js';

const router = Router();

// All routes require a logged-in user; writes are further restricted below.
router.use(authenticate);

router.get('/', validateQuery(listDailyReportsQuerySchema), dailyReportController.listDailyReports);
router.get('/:id', dailyReportController.getDailyReport);

// Accountants don't file site reports — writers here are the roles that are
// actually on site or managing it. Ownership (an engineer may only touch
// their own report) is enforced in the service layer, same as Task progress.
const CAN_FILE_REPORTS = ['super_admin', 'project_manager', 'site_engineer'] as const;

router.post(
  '/',
  authorize(...CAN_FILE_REPORTS),
  handleDailyReportUpload,
  validateBody(createDailyReportSchema),
  dailyReportController.createDailyReport,
);

router.put(
  '/:id',
  authorize(...CAN_FILE_REPORTS),
  validateBody(updateDailyReportSchema),
  dailyReportController.updateDailyReport,
);

router.delete('/:id', authorize('super_admin'), dailyReportController.deleteDailyReport);

router.post(
  '/:id/media',
  authorize(...CAN_FILE_REPORTS),
  handleDailyReportUpload,
  dailyReportController.addMedia,
);

router.post(
  '/:id/issues',
  authorize(...CAN_FILE_REPORTS),
  validateBody(addIssueSchema),
  dailyReportController.addIssue,
);

router.patch(
  '/:id/issues/:issueIndex',
  authorize(...CAN_FILE_REPORTS),
  validateBody(updateIssueSchema),
  dailyReportController.updateIssue,
);

export default router;
