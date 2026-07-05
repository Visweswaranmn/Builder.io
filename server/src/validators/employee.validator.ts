import { z } from 'zod';
import { DEPARTMENTS, ATTENDANCE_STATUSES } from '../constants/enums.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid ObjectId');

export const createEmployeeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  phone: z.string().trim().max(20).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  designation: z.string().trim().max(100).optional(),
  salary: z.coerce.number().min(0).optional(),
  dateOfJoining: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional(),
  user: objectId.optional(),
  project: objectId.optional(),
  manager: objectId.optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  phone: z.string().trim().max(20).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  designation: z.string().trim().max(100).optional(),
  salary: z.coerce.number().min(0).optional(),
  dateOfJoining: z.coerce.date().optional(),
  isActive: z.coerce.boolean().optional(),
  user: objectId.optional(),
  project: objectId.optional(),
  manager: objectId.optional(),
});

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  department: z.enum(DEPARTMENTS).optional(),
  project: objectId.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});

export const markAttendanceSchema = z.object({
  date: z.coerce.date({ errorMap: () => ({ message: 'Invalid date' }) }),
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  note: z.string().trim().max(300).optional(),
});

export const attendanceQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
