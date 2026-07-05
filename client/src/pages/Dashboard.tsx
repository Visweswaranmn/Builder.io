import { useEffect, useState, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { FolderKanban, Users, Wallet, Receipt, ListChecks } from 'lucide-react';
import { api } from '@/lib/axios';
import PageHeader from '@/components/PageHeader';
import Alert from '@/components/ui/Alert';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import type { DashboardSummary } from '@/types/dashboard';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const STATUS_COLORS: Record<string, string> = {
  planning: '#8CB893',
  in_progress: '#2F6B51',
  on_hold: '#f59e0b',
  completed: '#10b981',
  cancelled: '#ef4444',
};

interface CardProps {
  label: string;
  value: string;
  icon: typeof FolderKanban;
}

function Card({ label, value, icon: Icon }: CardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-panel p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-panel p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{title}</h2>
      <div className="mt-4 h-64">{children}</div>
    </div>
  );
}

type Status = 'loading' | 'ok' | 'error';

export default function Dashboard() {
  const [status, setStatus] = useState<Status>('loading');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api
      .get<{ data: DashboardSummary }>('/dashboard/summary')
      .then((res) => {
        if (!active) return;
        setSummary(res.data.data);
        setStatus('ok');
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (status === 'error' || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <Alert tone="error">Failed to load dashboard: {error}</Alert>
      </div>
    );
  }

  const { cards, charts } = summary;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="A live snapshot of every active project, team, and budget." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Active Projects" value={String(cards.activeProjects)} icon={FolderKanban} />
        <Card label="Employees" value={String(cards.totalEmployees)} icon={Users} />
        <Card label="Budget" value={currency.format(cards.totalBudget)} icon={Wallet} />
        <Card label="Expenses" value={currency.format(cards.totalExpenses)} icon={Receipt} />
        <Card label="Pending Tasks" value={String(cards.pendingTasks)} icon={ListChecks} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Project Progress">
          {charts.projectProgress.length === 0 ? (
            <EmptyState message="No projects yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.projectProgress} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value ?? 0}%`, 'Progress']} />
                <Bar dataKey="progress" radius={[0, 4, 4, 0]}>
                  {charts.projectProgress.map((p) => (
                    <Cell key={p.name} fill={STATUS_COLORS[p.status] ?? '#2F6B51'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Monthly Expenses">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.monthlyExpenses}>
              <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [currency.format(Number(value ?? 0)), 'Expenses']} />
              <Line type="monotone" dataKey="total" stroke="#2F6B51" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Material Usage">
          {charts.materialUsage.length === 0 ? (
            <EmptyState message="No stock movements yet" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.materialUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#CFE3D2" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, _name, item) => [
                    `${value ?? 0} ${(item?.payload as { unit?: string } | undefined)?.unit ?? ''}`,
                    'Used',
                  ]}
                />
                <Bar dataKey="used" fill="#3F7D61" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
