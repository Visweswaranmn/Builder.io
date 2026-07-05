import { z } from 'zod';
import { TASK_STATUSES, PRIORITIES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
  description: z.string().trim().max(2000).optional(),
  project: objectId,
  assignedTo: objectId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  project: objectId.optional(),
  assignedTo: objectId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
});

/** Narrower schema for the ownership-based progress endpoint — status/progress only. */
export const updateProgressSchema = z
  .object({
    status: z.enum(TASK_STATUSES).optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
  })
  .refine((data) => data.status !== undefined || data.progress !== undefined, {
    message: 'Provide at least one of status or progress',
  });

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  project: objectId.optional(),
  assignedTo: objectId.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedToMe: z.coerce.boolean().optional(),
  search: z.string().trim().max(200).optional(),
});
