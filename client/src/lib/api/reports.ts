import { api } from '@/lib/axios';
import type {
  ProjectReportRow,
  ExpenseReportRow,
  ExpenseReportSummary,
  EmployeeReportRow,
  MaterialReportRow,
} from '@/types/reports';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

const EXTENSIONS: Record<ExportFormat, string> = { csv: 'csv', excel: 'xlsx', pdf: 'pdf' };

function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/** Fetches a report as a file (CSV/Excel/PDF) and triggers a browser download. */
async function exportReport(
  path: string,
  params: Record<string, unknown>,
  format: ExportFormat,
  filenameBase: string,
): Promise<void> {
  const res = await api.get(path, { params: { ...params, format }, responseType: 'blob' });
  downloadBlob(res.data as Blob, `${filenameBase}.${EXTENSIONS[format]}`);
}

export async function fetchProjectsReport(params: Record<string, unknown> = {}) {
  const res = await api.get<{ data: { rows: ProjectReportRow[] } }>('/reports/projects', { params });
  return res.data.data.rows;
}
export function exportProjectsReport(params: Record<string, unknown>, format: ExportFormat) {
  return exportReport('/reports/projects', params, format, 'project-report');
}

export async function fetchExpensesReport(params: Record<string, unknown> = {}) {
  const res = await api.get<{ data: { rows: ExpenseReportRow[]; summary: ExpenseReportSummary } }>(
    '/reports/expenses',
    { params },
  );
  return res.data.data;
}
export function exportExpensesReport(params: Record<string, unknown>, format: ExportFormat) {
  return exportReport('/reports/expenses', params, format, 'expense-report');
}

export async function fetchEmployeesReport(params: Record<string, unknown> = {}) {
  const res = await api.get<{ data: { rows: EmployeeReportRow[] } }>('/reports/employees', { params });
  return res.data.data.rows;
}
export function exportEmployeesReport(params: Record<string, unknown>, format: ExportFormat) {
  return exportReport('/reports/employees', params, format, 'employee-report');
}

export async function fetchMaterialsReport(params: Record<string, unknown> = {}) {
  const res = await api.get<{ data: { rows: MaterialReportRow[] } }>('/reports/materials', { params });
  return res.data.data.rows;
}
export function exportMaterialsReport(params: Record<string, unknown>, format: ExportFormat) {
  return exportReport('/reports/materials', params, format, 'material-report');
}
