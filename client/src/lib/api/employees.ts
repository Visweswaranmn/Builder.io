import { api } from '@/lib/axios';
import type { Employee, PaginationMeta, Department, AttendanceEntry, AttendanceStatus } from '@/types/models';

export interface EmployeeListParams {
  page?: number;
  limit?: number;
  department?: Department;
  project?: string;
  isActive?: boolean;
  search?: string;
}

export async function listEmployees(params: EmployeeListParams = {}) {
  const res = await api.get<{ data: { employees: Employee[]; meta: PaginationMeta } }>('/employees', { params });
  return res.data.data;
}

export async function getEmployee(id: string) {
  const res = await api.get<{ data: { employee: Employee } }>(`/employees/${id}`);
  return res.data.data.employee;
}

export async function createEmployee(payload: Record<string, unknown>) {
  const res = await api.post<{ data: { employee: Employee } }>('/employees', payload);
  return res.data.data.employee;
}

export async function updateEmployee(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { employee: Employee } }>(`/employees/${id}`, payload);
  return res.data.data.employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  await api.delete(`/employees/${id}`);
}

export async function markAttendance(
  id: string,
  entry: { date: string; status: AttendanceStatus; note?: string },
) {
  const res = await api.post<{ data: { attendance: AttendanceEntry[] } }>(`/employees/${id}/attendance`, entry);
  return res.data.data.attendance;
}

export async function getAttendance(id: string, params: { from?: string; to?: string } = {}) {
  const res = await api.get<{ data: { attendance: AttendanceEntry[] } }>(`/employees/${id}/attendance`, { params });
  return res.data.data.attendance;
}
