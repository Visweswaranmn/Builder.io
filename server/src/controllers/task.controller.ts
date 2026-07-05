import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as taskService from '../services/task.service.js';

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const { tasks, meta } = await taskService.listTasks(req.validatedQuery ?? {}, req.user.id);
  res.json({ success: true, data: { tasks, meta } });
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.getTaskById(req.params.id);
  res.json({ success: true, data: { task } });
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const task = await taskService.createTask(req.body, req.user.id);
  res.status(201).json({ success: true, message: 'Task created', data: { task } });
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await taskService.updateTask(req.params.id, req.body);
  res.json({ success: true, message: 'Task updated', data: { task } });
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  await taskService.deleteTask(req.params.id);
  res.json({ success: true, message: 'Task deleted' });
});

export const updateTaskProgress = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  const task = await taskService.updateTaskProgress(req.params.id, req.body, req.user);
  res.json({ success: true, message: 'Task progress updated', data: { task } });
});
