import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import EmptyState from '@/components/ui/EmptyState';
import { statusTone } from '@/lib/statusTone';
import * as reportsApi from '@/lib/api/reports';
import type { ExportFormat } from '@/lib/api/reports';
import type { ProjectReportRow, ExpenseReportRow, ExpenseReportSummary, EmployeeReportRow, MaterialReportRow } from '@/types/reports';

type Tab = 'projects' | 'expenses' | 'employees' | 'materials';

const TABS: { key: Tab; label: string }[] = [
  { key: 'projects', label: 'Project Reports' },
  { key: 'expenses', label: 'Expense Reports' },
  { key: 'employees', label: 'Employee Reports' },
  { key: 'materials', label: 'Material Reports' },
];

const CATEGORY_COLORS: Record<string, string> = {
  material: '#2F6B51',
  labour: '#3F7D61',
  transport: '#8CB893',
  equipment: '#5B8C6E',
  utilities: '#B5D4B9',
  other: '#CFE3D2',
};

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-panel p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      <div className="mt-4 h-72">{children}</div>
    </div>
  );
}

function ExportButtons({ onExport }: { onExport: (format: ExportFormat) => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => onExport('csv')}>
        Export CSV
      </Button>
      <Button variant="secondary" onClick={() => onExport('excel')}>
        Export Excel
      </Button>
      <Button variant="secondary" onClick={() => onExport('pdf')}>
        Export PDF
      </Button>
    </div>
  );
}

function ProjectsReportTab() {
  const [rows, setRows] = useState<ProjectReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .fetchProjectsReport()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<ProjectReportRow>[] = [
    { key: 'name', label: 'Project' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={statusTone(r.status)}>{r.status.replace('_', ' ')}</Badge> },
    { key: 'progress', label: 'Progress %' },
    { key: 'budget', label: 'Budget', render: (r) => r.budget.toLocaleString('en-IN') },
    { key: 'actualExpense', label: 'Actual Spend', render: (r) => r.actualExpense.toLocaleString('en-IN') },
    { key: 'variance', label: 'Variance', render: (r) => r.variance.toLocaleString('en-IN') },
    { key: 'managerName', label: 'Manager' },
    { key: 'employeeCount', label: 'Employees' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons onExport={(format) => reportsApi.exportProjectsReport({}, format)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ChartCard title="Budget vs Actual Spend by Project">
        {rows.length === 0 ? (
          <EmptyState message="No projects yet" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => currency.format(Number(value ?? 0))} />
              <Legend />
              <Bar dataKey="budget" name="Budget" fill="#8CB893" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actualExpense" name="Actual Spend" fill="#2F6B51" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.id} emptyMessage="No projects yet." />
    </div>
  );
}

function ExpensesReportTab() {
  const [rows, setRows] = useState<ExpenseReportRow[]>([]);
  const [summary, setSummary] = useState<ExpenseReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .fetchExpensesReport()
      .then((r) => {
        setRows(r.rows);
        setSummary(r.summary);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<ExpenseReportRow>[] = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'projectName', label: 'Project' },
    { key: 'category', label: 'Category', render: (r) => <Badge tone="blue">{r.category}</Badge> },
    { key: 'amount', label: 'Amount', render: (r) => r.amount.toLocaleString('en-IN') },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'recordedByName', label: 'Recorded By' },
  ];

  const byProject = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = r.projectName ?? 'Unassigned';
      totals.set(key, (totals.get(key) ?? 0) + r.amount);
    }
    return Array.from(totals, ([name, total]) => ({ name, total }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {summary && (
          <div className="flex gap-4 text-sm text-ink-muted">
            <span>
              Total: <strong>{summary.total.toLocaleString('en-IN')}</strong>
            </span>
            {summary.byCategory.map((c) => (
              <span key={c.category}>
                {c.category}: {c.total.toLocaleString('en-IN')}
              </span>
            ))}
          </div>
        )}
        <ExportButtons onExport={(format) => reportsApi.exportExpensesReport({}, format)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Expenses by Category">
          {!summary || summary.byCategory.length === 0 ? (
            <EmptyState message="No expenses yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.byCategory} margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => currency.format(Number(value ?? 0))} />
                <Bar dataKey="total" name="Amount" radius={[4, 4, 0, 0]}>
                  {summary.byCategory.map((c) => (
                    <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? '#2F6B51'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Expenses by Project">
          {byProject.length === 0 ? (
            <EmptyState message="No expenses yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProject} margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => currency.format(Number(value ?? 0))} />
                <Bar dataKey="total" name="Amount" fill="#3F7D61" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.id} emptyMessage="No expenses yet." />
    </div>
  );
}

function EmployeesReportTab() {
  const [rows, setRows] = useState<EmployeeReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .fetchEmployeesReport()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<EmployeeReportRow>[] = [
    { key: 'name', label: 'Name' },
    { key: 'department', label: 'Department', render: (r) => <span className="capitalize">{r.department}</span> },
    { key: 'projectName', label: 'Project' },
    { key: 'salary', label: 'Salary', render: (r) => r.salary.toLocaleString('en-IN') },
    { key: 'present', label: 'Present' },
    { key: 'absent', label: 'Absent' },
    { key: 'halfDay', label: 'Half Day' },
    { key: 'leave', label: 'Leave' },
  ];

  const byDepartment = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.department, (totals.get(r.department) ?? 0) + 1);
    }
    return Array.from(totals, ([department, count]) => ({ department, count }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons onExport={(format) => reportsApi.exportEmployeesReport({}, format)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ChartCard title="Headcount by Department">
        {byDepartment.length === 0 ? (
          <EmptyState message="No employees yet" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDepartment} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
              <XAxis dataKey="department" tick={{ fontSize: 12 }} className="capitalize" />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Employees" fill="#2F6B51" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.id} emptyMessage="No employees yet." />
    </div>
  );
}

function MaterialsReportTab() {
  const [rows, setRows] = useState<MaterialReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi
      .fetchMaterialsReport()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  const columns: Column<MaterialReportRow>[] = [
    { key: 'name', label: 'Material' },
    { key: 'category', label: 'Category', render: (r) => <span className="capitalize">{r.category}</span> },
    { key: 'quantityInStock', label: 'In Stock', render: (r) => `${r.quantityInStock} ${r.unit}` },
    { key: 'stockValue', label: 'Stock Value', render: (r) => r.stockValue.toLocaleString('en-IN') },
    { key: 'totalStockIn', label: 'Stock In' },
    { key: 'totalStockOut', label: 'Stock Out' },
    { key: 'isLowStock', label: 'Low Stock', render: (r) => (r.isLowStock ? <Badge tone="red">Yes</Badge> : <Badge tone="green">No</Badge>) },
  ];

  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) {
      totals.set(r.category, (totals.get(r.category) ?? 0) + r.stockValue);
    }
    return Array.from(totals, ([category, value]) => ({ category, value }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ExportButtons onExport={(format) => reportsApi.exportMaterialsReport({}, format)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ChartCard title="Stock Value by Category">
        {byCategory.length === 0 ? (
          <EmptyState message="No materials yet" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byCategory} margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => currency.format(Number(value ?? 0))} />
              <Bar dataKey="value" name="Stock Value" radius={[4, 4, 0, 0]}>
                {byCategory.map((c) => (
                  <Cell key={c.category} fill={CATEGORY_COLORS[c.category] ?? '#2F6B51'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(r) => r.id} emptyMessage="No materials yet." />
    </div>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('projects');

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Generate and export reports across every module." />

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'projects' && <ProjectsReportTab />}
      {tab === 'expenses' && <ExpensesReportTab />}
      {tab === 'employees' && <EmployeesReportTab />}
      {tab === 'materials' && <MaterialsReportTab />}
    </div>
  );
}
