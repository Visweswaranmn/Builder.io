import { z } from 'zod';
import { PROJECT_STATUSES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

export const createProjectSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(150),
    client: z.string().trim().min(1, 'Client is required').max(150),
    budget: z.coerce.number().min(0, 'Budget must be a positive number'),
    startDate: z.coerce.date({ errorMap: () => ({ message: 'Invalid start date' }) }),
    endDate: z.coerce.date({ errorMap: () => ({ message: 'Invalid end date' }) }).optional(),
    location: z.string().trim().max(200).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    description: z.string().trim().max(2000).optional(),
    manager: objectId.optional(),
  })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    client: z.string().trim().min(1).max(150).optional(),
    budget: z.coerce.number().min(0).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    location: z.string().trim().max(200).optional(),
    status: z.enum(PROJECT_STATUSES).optional(),
    description: z.string().trim().max(2000).optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    manager: objectId.optional(),
  })
  .refine((data) => !data.endDate || !data.startDate || data.endDate >= data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });

export const listProjectsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  search: z.string().trim().max(150).optional(),
});
