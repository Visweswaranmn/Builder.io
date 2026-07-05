import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');
const severity = z.enum(['low', 'medium', 'high']);

export const createDailyReportSchema = z.object({
  project: objectId,
  date: z.coerce.date().optional(),
  workDone: z.string().trim().max(3000).optional(),
  progressPercentage: z.coerce.number().min(0).max(100).optional(),
  laborCount: z.coerce.number().min(0).optional(),
  weather: z.string().trim().max(100).optional(),
});

/**
 * `project` and `engineer` are intentionally excluded — a report is tied to
 * the project/engineer it was filed for; images/videos only change via the
 * dedicated media-upload endpoint.
 */
export const updateDailyReportSchema = z.object({
  date: z.coerce.date().optional(),
  workDone: z.string().trim().max(3000).optional(),
  progressPercentage: z.coerce.number().min(0).max(100).optional(),
  laborCount: z.coerce.number().min(0).optional(),
  weather: z.string().trim().max(100).optional(),
});

export const listDailyReportsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  project: objectId.optional(),
  engineer: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const addIssueSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(500),
  severity: severity.optional(),
});

export const updateIssueSchema = z
  .object({
    severity: severity.optional(),
    resolved: z.coerce.boolean().optional(),
  })
  .refine((data) => data.severity !== undefined || data.resolved !== undefined, {
    message: 'Provide at least one of severity or resolved',
  });
