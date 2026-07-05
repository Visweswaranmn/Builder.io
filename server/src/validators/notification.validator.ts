import { z } from 'zod';
import { NOTIFICATION_TYPES } from '../constants/enums.js';

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  isRead: z.coerce.boolean().optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
});
