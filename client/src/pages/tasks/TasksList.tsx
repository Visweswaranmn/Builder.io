import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { SelectField, TextField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import { useAuth } from '@/context/AuthContext';
import * as tasksApi from '@/lib/api/tasks';
import type { Task, TaskStatus, Priority, PaginationMeta } from '@/types/models';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
  { value: 'blocked', label: 'Blocked' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TasksList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [mineOnly, setMineOnly] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [progressTarget, setProgressTarget] = useState<Task | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await tasksApi.listTasks({
        page,
        status: (status || undefined) as TaskStatus | undefined,
        priority: (priority || undefined) as Priority | undefined,
        assignedToMe: mineOnly || undefined,
      });
      setTasks(result.tasks);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, priority, mineOnly]);

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await tasksApi.deleteTask(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete task');
      setPendingDelete(null);
    }
  }

  const columns: Column<Task>[] = [
    { key: 'title', label: 'Task', render: (t) => <span className="font-medium text-ink">{t.title}</span> },
    { key: 'project', label: 'Project', render: (t) => t.project?.name ?? '—' },
    { key: 'assignedTo', label: 'Assigned To', render: (t) => t.assignedTo?.name ?? 'Unassigned' },
    { key: 'priority', label: 'Priority', render: (t) => <Badge tone={statusTone(t.priority)}>{t.priority}</Badge> },
    {
      key: 'status',
      label: 'Status',
      render: (t) => (
        <div className="flex items-center gap-2">
          <Badge tone={statusTone(t.status)}>{t.status.replace('_', ' ')}</Badge>
          {t.isOverdue && <Badge tone="red">overdue</Badge>}
        </div>
      ),
    },
    { key: 'progress', label: 'Progress', render: (t) => `${t.progress}%` },
    {
      key: 'actions',
      label: '',
      render: (t) => (
        <div className="flex gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setProgressTarget(t);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Update Progress
          </button>
          <RoleGate roles={['super_admin']}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(t);
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          </RoleGate>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Assignments, priority, and progress across every project."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/tasks/new')}>+ New Task</Button>
          </RoleGate>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
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
        <div className="w-48">
          <SelectField
            label="Priority"
            placeholder="All priorities"
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {user && user.role !== 'accountant' && (
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => {
                setMineOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-slate-300"
            />
            My tasks only
          </label>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={tasks}
        loading={loading}
        rowKey={(t) => t._id}
        onRowClick={(t) => navigate(`/tasks/${t._id}/edit`)}
        emptyMessage="No tasks found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${pendingDelete.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {progressTarget && (
        <ProgressModal task={progressTarget} onClose={() => setProgressTarget(null)} onSaved={load} />
      )}
    </div>
  );
}

function ProgressModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [progress, setProgress] = useState(String(task.progress));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await tasksApi.updateTaskProgress(task._id, { status, progress: Number(progress) });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update progress');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Update Progress — ${task.title}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setStatus(e.target.value as TaskStatus)}
        />
        <TextField
          label="Progress %"
          type="number"
          min={0}
          max={100}
          value={progress}
          onChange={(e) => setProgress(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
