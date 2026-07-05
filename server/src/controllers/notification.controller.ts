import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import * as notificationService from '../services/notification.service.js';

function requireUserId(req: Request): string {
  if (!req.user) throw ApiError.unauthorized('Authentication required');
  return req.user.id;
}

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const { notifications, meta } = await notificationService.listNotifications(
    userId,
    req.validatedQuery ?? {},
  );
  res.json({ success: true, data: { notifications, meta } });
});

export const getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const count = await notificationService.getUnreadCount(userId);
  res.json({ success: true, data: { count } });
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const notification = await notificationService.markAsRead(userId, req.params.id);
  res.json({ success: true, message: 'Notification marked as read', data: { notification } });
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  const modifiedCount = await notificationService.markAllAsRead(userId);
  res.json({ success: true, message: 'All notifications marked as read', data: { modifiedCount } });
});

export const deleteNotification = asyncHandler(async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  await notificationService.deleteNotification(userId, req.params.id);
  res.json({ success: true, message: 'Notification deleted' });
});

export const runDeadlineReminders = asyncHandler(async (_req: Request, res: Response) => {
  const result = await notificationService.runDeadlineReminders();
  res.json({ success: true, message: 'Deadline reminder scan complete', data: result });
});
