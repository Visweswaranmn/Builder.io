import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as reportService from '../services/report.service.js';
import { getCategorySummary } from '../services/expense.service.js';
import { toCsv, toExcelBuffer, buildTablePdf, type ReportColumn } from '../utils/reportExport.js';

type ExportFormat = 'json' | 'csv' | 'excel' | 'pdf';

/** Dispatches a report's rows to JSON, CSV, Excel, or PDF based on `?format=`. */
async function respondWithReport<T>(
  res: Response,
  format: ExportFormat | undefined,
  filenameBase: string,
  title: string,
  columns: ReportColumn<T>[],
  rows: T[],
  extraJson?: Record<string, unknown>,
): Promise<void> {
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
    res.send(toCsv(columns, rows));
    return;
  }

  if (format === 'excel') {
    const buffer = await toExcelBuffer(columns, rows, filenameBase);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
    res.send(buffer);
    return;
  }

  if (format === 'pdf') {
    const doc = buildTablePdf(title, columns, rows);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    doc.pipe(res);
    doc.end();
    return;
  }

  res.json({ success: true, data: { rows, ...extraJson } });
}

const PROJECT_COLUMNS: ReportColumn<reportService.ProjectReportRow>[] = [
  { key: 'name', label: 'Project' },
  { key: 'client', label: 'Client' },
  { key: 'status', label: 'Status' },
  { key: 'progress', label: 'Progress %' },
  { key: 'budget', label: 'Budget' },
  { key: 'actualExpense', label: 'Actual Spend' },
  { key: 'variance', label: 'Variance' },
  { key: 'managerName', label: 'Manager' },
  { key: 'employeeCount', label: 'Employees' },
  { key: 'startDate', label: 'Start Date', formatter: (r) => r.startDate?.toDateString() },
];

const EXPENSE_COLUMNS: ReportColumn<reportService.ExpenseReportRow>[] = [
  { key: 'date', label: 'Date', formatter: (r) => r.date.toDateString() },
  { key: 'projectName', label: 'Project' },
  { key: 'category', label: 'Category' },
  { key: 'amount', label: 'Amount' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'recordedByName', label: 'Recorded By' },
  { key: 'description', label: 'Description' },
];

const EMPLOYEE_COLUMNS: ReportColumn<reportService.EmployeeReportRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' },
  { key: 'projectName', label: 'Project' },
  { key: 'salary', label: 'Salary' },
  { key: 'isActive', label: 'Active', formatter: (r) => (r.isActive ? 'Yes' : 'No') },
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'halfDay', label: 'Half Day' },
  { key: 'leave', label: 'Leave' },
];

const MATERIAL_COLUMNS: ReportColumn<reportService.MaterialReportRow>[] = [
  { key: 'name', label: 'Material' },
  { key: 'category', label: 'Category' },
  { key: 'unit', label: 'Unit' },
  { key: 'quantityInStock', label: 'In Stock' },
  { key: 'lowStockThreshold', label: 'Threshold' },
  { key: 'isLowStock', label: 'Low Stock', formatter: (r) => (r.isLowStock ? 'Yes' : 'No') },
  { key: 'unitPrice', label: 'Unit Price' },
  { key: 'stockValue', label: 'Stock Value' },
  { key: 'totalStockIn', label: 'Stock In' },
  { key: 'totalStockOut', label: 'Stock Out' },
  { key: 'vendorName', label: 'Vendor' },
  { key: 'projectName', label: 'Project' },
];

export const getProjectsReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery ?? {};
  const rows = await reportService.getProjectsReport(query);
  await respondWithReport(
    res,
    query.format as ExportFormat,
    'project-report',
    'Project Report',
    PROJECT_COLUMNS,
    rows,
  );
});

export const getExpensesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery ?? {};
  const [rows, summary] = await Promise.all([
    reportService.getExpensesReport(query),
    getCategorySummary(query),
  ]);
  await respondWithReport(
    res,
    query.format as ExportFormat,
    'expense-report',
    'Expense Report',
    EXPENSE_COLUMNS,
    rows,
    { summary },
  );
});

export const getEmployeesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery ?? {};
  const rows = await reportService.getEmployeesReport(query);
  await respondWithReport(
    res,
    query.format as ExportFormat,
    'employee-report',
    'Employee Report',
    EMPLOYEE_COLUMNS,
    rows,
  );
});

export const getMaterialsReport = asyncHandler(async (req: Request, res: Response) => {
  const query = req.validatedQuery ?? {};
  const rows = await reportService.getMaterialsReport(query);
  await respondWithReport(
    res,
    query.format as ExportFormat,
    'material-report',
    'Material Report',
    MATERIAL_COLUMNS,
    rows,
  );
});
