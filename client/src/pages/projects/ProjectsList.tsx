import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SelectField, TextField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import * as projectsApi from '@/lib/api/projects';
import type { Project, ProjectStatus, PaginationMeta } from '@/types/models';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await projectsApi.listProjects({
        page,
        status: (status || undefined) as ProjectStatus | undefined,
        search: search || undefined,
      });
      setProjects(result.projects);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await projectsApi.deleteProject(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
      setPendingDelete(null);
    }
  }

  const columns: Column<Project>[] = [
    { key: 'name', label: 'Project', render: (p) => <span className="font-medium text-ink">{p.name}</span> },
    { key: 'client', label: 'Client' },
    { key: 'status', label: 'Status', render: (p) => <Badge tone={statusTone(p.status)}>{p.status.replace('_', ' ')}</Badge> },
    {
      key: 'progress',
      label: 'Progress',
      render: (p) => (
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full bg-brand-600" style={{ width: `${p.progress}%` }} />
          </div>
          <span className="text-xs text-ink-muted">{p.progress}%</span>
        </div>
      ),
    },
    { key: 'budget', label: 'Budget', render: (p) => currency.format(p.budget) },
    { key: 'manager', label: 'Manager', render: (p) => p.manager?.name ?? '—' },
    {
      key: 'actions',
      label: '',
      render: (p) => (
        <RoleGate roles={['super_admin']}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(p);
            }}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Delete
          </button>
        </RoleGate>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track budgets, progress, and status across every active project."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/projects/new')}>+ New Project</Button>
          </RoleGate>
        }
      />

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <TextField label="Search" placeholder="Project name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <SelectField
            label="Status"
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={projects}
        loading={loading}
        rowKey={(p) => p._id}
        onRowClick={(p) => navigate(`/projects/${p._id}`)}
        emptyMessage="No projects found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${pendingDelete.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
