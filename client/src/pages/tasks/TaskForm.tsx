import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { TextField, TextareaField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as tasksApi from '@/lib/api/tasks';
import * as projectsApi from '@/lib/api/projects';
import * as employeesApi from '@/lib/api/employees';
import type { Priority, Project, Employee } from '@/types/models';

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : '';
}

export default function TaskForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin';

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    project: '',
    assignedTo: '',
    priority: 'medium' as Priority,
    startDate: '',
    deadline: '',
  });

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
    employeesApi.listEmployees({ limit: 100 }).then((r) => setEmployees(r.employees)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    tasksApi
      .getTask(id)
      .then((t) => {
        setForm({
          title: t.title,
          description: t.description ?? '',
          project: t.project?._id ?? '',
          assignedTo: t.assignedTo?._id ?? '',
          priority: t.priority,
          startDate: toDateInput(t.startDate),
          deadline: toDateInput(t.deadline),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load task'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!isEdit && !canEdit) {
    return <Navigate to="/tasks" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      project: form.project,
      assignedTo: form.assignedTo || undefined,
      priority: form.priority,
      startDate: form.startDate || undefined,
      deadline: form.deadline || undefined,
    };

    try {
      if (isEdit && id) {
        await tasksApi.updateTask(id, payload);
      } else {
        await tasksApi.createTask(payload);
      }
      navigate('/tasks');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save task');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Task' : 'New Task'} />

      {!canEdit && <Alert tone="info">Only a Super Admin can change task details. Viewing read-only.</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <TextField
          label="Title"
          required
          disabled={!canEdit}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Project"
            required
            placeholder="Select a project"
            disabled={!canEdit}
            options={projects.map((p) => ({ value: p._id, label: p.name }))}
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
          />
          <SelectField
            label="Assigned To"
            placeholder="Unassigned"
            disabled={!canEdit}
            options={employees.map((emp) => ({ value: emp._id, label: emp.name }))}
            value={form.assignedTo}
            onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Priority"
            disabled={!canEdit}
            options={PRIORITY_OPTIONS}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
          />
          <TextField
            label="Start Date"
            type="date"
            disabled={!canEdit}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <TextField
            label="Deadline"
            type="date"
            disabled={!canEdit}
            value={form.deadline}
            onChange={(e) => setForm({ ...form, deadline: e.target.value })}
          />
        </div>

        <TextareaField
          label="Description"
          disabled={!canEdit}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/tasks')}>
            {canEdit ? 'Cancel' : 'Back'}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
