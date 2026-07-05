import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as userService from '../services/user.service.js';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { users, meta } = await userService.listUsers(req.validatedQuery ?? {});
  res.json({ success: true, data: { users, meta } });
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  res.json({ success: true, data: { user } });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.createUser(req.body);
  res.status(201).json({ success: true, message: 'User created', data: { user } });
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id, req.body);
  res.json({ success: true, message: 'User updated', data: { user } });
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});
