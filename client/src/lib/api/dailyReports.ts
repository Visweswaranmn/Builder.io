import { api } from '@/lib/axios';
import type { DailyReport, PaginationMeta, Issue } from '@/types/models';

export interface DailyReportListParams {
  page?: number;
  limit?: number;
  project?: string;
  engineer?: string;
  from?: string;
  to?: string;
}

export async function listDailyReports(params: DailyReportListParams = {}) {
  const res = await api.get<{ data: { reports: DailyReport[]; meta: PaginationMeta } }>('/daily-reports', {
    params,
  });
  return res.data.data;
}

export async function getDailyReport(id: string) {
  const res = await api.get<{ data: { report: DailyReport } }>(`/daily-reports/${id}`);
  return res.data.data.report;
}

export interface DailyReportFormFields {
  project: string;
  date?: string;
  workDone?: string;
  progressPercentage?: number;
  laborCount?: number;
  weather?: string;
}

function buildFormData(fields: Record<string, unknown>, images: File[], videos: File[]): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  }
  images.forEach((file) => form.append('images', file));
  videos.forEach((file) => form.append('videos', file));
  return form;
}

export async function createDailyReport(
  fields: DailyReportFormFields,
  images: File[] = [],
  videos: File[] = [],
) {
  const form = buildFormData({ ...fields }, images, videos);
  const res = await api.post<{ data: { report: DailyReport } }>('/daily-reports', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.report;
}

export async function updateDailyReport(id: string, payload: Record<string, unknown>) {
  const res = await api.put<{ data: { report: DailyReport } }>(`/daily-reports/${id}`, payload);
  return res.data.data.report;
}

export async function deleteDailyReport(id: string): Promise<void> {
  await api.delete(`/daily-reports/${id}`);
}

export async function addMedia(id: string, images: File[] = [], videos: File[] = []) {
  const form = buildFormData({}, images, videos);
  const res = await api.post<{ data: { report: DailyReport } }>(`/daily-reports/${id}/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.report;
}

export async function addIssue(id: string, issue: { description: string; severity?: Issue['severity'] }) {
  const res = await api.post<{ data: { report: DailyReport } }>(`/daily-reports/${id}/issues`, issue);
  return res.data.data.report;
}

export async function updateIssue(
  id: string,
  issueIndex: number,
  payload: { severity?: Issue['severity']; resolved?: boolean },
) {
  const res = await api.patch<{ data: { report: DailyReport } }>(
    `/daily-reports/${id}/issues/${issueIndex}`,
    payload,
  );
  return res.data.data.report;
}
