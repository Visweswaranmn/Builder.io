import { api } from '@/lib/axios';
import type { AppNotification, PaginationMeta, NotificationType } from '@/types/models';

export interface NotificationListParams {
  page?: number;
  limit?: number;
  isRead?: boolean;
  type?: NotificationType;
}

export async function listNotifications(params: NotificationListParams = {}) {
  const res = await api.get<{ data: { notifications: AppNotification[]; meta: PaginationMeta } }>(
    '/notifications',
    { params },
  );
  return res.data.data;
}

export async function getUnreadCount(): Promise<number> {
  const res = await api.get<{ data: { count: number } }>('/notifications/unread-count');
  return res.data.data.count;
}

export async function markAsRead(id: string) {
  const res = await api.patch<{ data: { notification: AppNotification } }>(`/notifications/${id}/read`);
  return res.data.data.notification;
}

export async function markAllAsRead(): Promise<number> {
  const res = await api.patch<{ data: { modifiedCount: number } }>('/notifications/read-all');
  return res.data.data.modifiedCount;
}

export async function deleteNotification(id: string): Promise<void> {
  await api.delete(`/notifications/${id}`);
}
