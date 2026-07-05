import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import * as dailyReportsApi from '@/lib/api/dailyReports';
import type { DailyReport, PaginationMeta } from '@/types/models';

export default function DailyReportsList() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await dailyReportsApi.listDailyReports({ page });
      setReports(result.reports);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const columns: Column<DailyReport>[] = [
    { key: 'date', label: 'Date', render: (r) => new Date(r.date).toLocaleDateString() },
    { key: 'project', label: 'Project', render: (r) => r.project?.name ?? '—' },
    { key: 'engineer', label: 'Engineer', render: (r) => r.engineer?.name ?? '—' },
    { key: 'progressPercentage', label: 'Progress', render: (r) => `${r.progressPercentage}%` },
    { key: 'weather', label: 'Weather' },
    {
      key: 'media',
      label: 'Media',
      render: (r) => (
        <span className="text-xs text-ink-muted">
          {r.images.length} photos · {r.videos.length} videos
        </span>
      ),
    },
    {
      key: 'issues',
      label: 'Issues',
      render: (r) =>
        r.issues.length === 0 ? (
          '—'
        ) : (
          <Badge tone={r.issues.some((i) => !i.resolved) ? 'amber' : 'green'}>
            {r.issues.filter((i) => !i.resolved).length} open
          </Badge>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Site Progress"
        description="Engineer-filed reports: work done, photos, weather, and site issues."
        actions={
          <RoleGate roles={['super_admin', 'project_manager', 'site_engineer']}>
            <Button onClick={() => navigate('/daily-reports/new')}>+ New Report</Button>
          </RoleGate>
        }
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={reports}
        loading={loading}
        rowKey={(r) => r._id}
        onRowClick={(r) => navigate(`/daily-reports/${r._id}`)}
        emptyMessage="No daily reports filed yet."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
