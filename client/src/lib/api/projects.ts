import { api } from '@/lib/axios';
import type { Project, PaginationMeta, ProjectStatus } from '@/types/models';

export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  search?: string;
}

export async function listProjects(params: ProjectListParams = {}) {
  const res = await api.get<{ data: { projects: Project[]; meta: PaginationMeta } }>('/projects', { params });
  return res.data.data;
}

export async function getProject(id: string) {
  const res = await api.get<{ data: { project: Project } }>(`/projects/${id}`);
  return res.data.data.project;
}

export async function createProject(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { project: Project } }>('/projects', payload);
  return res.data.data.project;
}

export async function updateProject(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { project: Project } }>(`/projects/${id}`, payload);
  return res.data.data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}
