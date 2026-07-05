import { api } from '@/lib/axios';
import type { AppUser, PaginationMeta } from '@/types/models';
import type { UserRole } from '@/types/auth';

export interface UserListParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  isActive?: boolean;
  search?: string;
}

export async function listUsers(params: UserListParams = {}) {
  const res = await api.get<{ data: { users: AppUser[]; meta: PaginationMeta } }>('/users', { params });
  return res.data.data;
}

export async function getUser(id: string) {
  const res = await api.get<{ data: { user: AppUser } }>(`/users/${id}`);
  return res.data.data.user;
}

export async function createUser(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { user: AppUser } }>('/users', payload);
  return res.data.data.user;
}

export async function updateUser(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { user: AppUser } }>(`/users/${id}`, payload);
  return res.data.data.user;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}
