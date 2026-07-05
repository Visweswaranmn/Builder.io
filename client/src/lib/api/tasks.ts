import { api } from '@/lib/axios';
import type { Task, PaginationMeta, TaskStatus, Priority } from '@/types/models';

export interface TaskListParams {
  page?: number;
  limit?: number;
  project?: string;
  assignedTo?: string;
  status?: TaskStatus;
  priority?: Priority;
  assignedToMe?: boolean;
  search?: string;
}

export async function listTasks(params: TaskListParams = {}) {
  const res = await api.get<{ data: { tasks: Task[]; meta: PaginationMeta } }>('/tasks', { params });
  return res.data.data;
}

export async function getTask(id: string) {
  const res = await api.get<{ data: { task: Task } }>(`/tasks/${id}`);
  return res.data.data.task;
}

export async function createTask(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { task: Task } }>('/tasks', payload);
  return res.data.data.task;
}

export async function updateTask(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { task: Task } }>(`/tasks/${id}`, payload);
  return res.data.data.task;
}

export async function deleteTask(id: string): Promise<void> {
  await api.delete(`/tasks/${id}`);
}

export async function updateTaskProgress(id: string, payload: { status?: TaskStatus; progress?: number }) {
  const res = await api.patch<{ data: { task: Task } }>(`/tasks/${id}/progress`, payload);
  return res.data.data.task;
}
