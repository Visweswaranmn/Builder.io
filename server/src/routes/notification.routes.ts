import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { listNotificationsQuerySchema } from '../validators/notification.validator.js';

const router = Router();

// Every notification route is scoped to the caller's own notifications —
// there is no "view another user's notifications" capability at all.
router.use(authenticate);

router.get('/', validateQuery(listNotificationsQuerySchema), notificationController.listNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllAsRead);
router.patch('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

// Administrative trigger for the deadline-reminder scan. In production this
// would be invoked by a scheduler (cron / cloud scheduler) rather than a user.
router.post(
  '/run-deadline-check',
  authorize('super_admin'),
  notificationController.runDeadlineReminders,
);

export default router;
