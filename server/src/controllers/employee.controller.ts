import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as employeeService from '../services/employee.service.js';

export const listEmployees = asyncHandler(async (req: Request, res: Response) => {
  const { employees, meta } = await employeeService.listEmployees(req.validatedQuery ?? {});
  res.json({ success: true, data: { employees, meta } });
});

export const getEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.getEmployeeById(req.params.id);
  res.json({ success: true, data: { employee } });
});

export const createEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.createEmployee(req.body);
  res.status(201).json({ success: true, message: 'Employee created', data: { employee } });
});

export const updateEmployee = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.updateEmployee(req.params.id, req.body);
  res.json({ success: true, message: 'Employee updated', data: { employee } });
});

export const deleteEmployee = asyncHandler(async (req: Request, res: Response) => {
  await employeeService.deleteEmployee(req.params.id);
  res.json({ success: true, message: 'Employee deleted' });
});

export const markAttendance = asyncHandler(async (req: Request, res: Response) => {
  const employee = await employeeService.markAttendance(req.params.id, req.body);
  res.status(201).json({
    success: true,
    message: 'Attendance recorded',
    data: { attendance: employee.attendance },
  });
});

export const getAttendance = asyncHandler(async (req: Request, res: Response) => {
  const attendance = await employeeService.getAttendance(req.params.id, req.validatedQuery ?? {});
  res.json({ success: true, data: { attendance } });
});
