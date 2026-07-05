import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { TextField, TextareaField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as projectsApi from '@/lib/api/projects';
import type { ProjectStatus } from '@/types/models';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : '';
}

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin';

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [managerName, setManagerName] = useState('');

  const [form, setForm] = useState({
    name: '',
    client: '',
    budget: '',
    startDate: '',
    endDate: '',
    location: '',
    status: 'planning' as ProjectStatus,
    description: '',
    progress: '',
  });

  useEffect(() => {
    if (!id) return;
    projectsApi
      .getProject(id)
      .then((p) => {
        setForm({
          name: p.name,
          client: p.client,
          budget: String(p.budget),
          startDate: toDateInput(p.startDate),
          endDate: toDateInput(p.endDate),
          location: p.location ?? '',
          status: p.status,
          description: p.description ?? '',
          progress: String(p.progress ?? 0),
        });
        setManagerName(p.manager?.name ?? '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load project'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!isEdit && !canEdit) {
    return <Navigate to="/projects" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      name: form.name,
      client: form.client,
      budget: Number(form.budget),
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      location: form.location || undefined,
      status: form.status,
      description: form.description || undefined,
    };
    if (isEdit) payload.progress = Number(form.progress);

    try {
      if (isEdit && id) {
        await projectsApi.updateProject(id, payload);
      } else {
        await projectsApi.createProject(payload);
      }
      navigate('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Project' : 'New Project'} />

      {!canEdit && <Alert tone="info">Only a Super Admin can change project details. Viewing read-only.</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Project Name"
            required
            disabled={!canEdit}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            label="Client"
            required
            disabled={!canEdit}
            value={form.client}
            onChange={(e) => setForm({ ...form, client: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Budget"
            type="number"
            min={0}
            required
            disabled={!canEdit}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
          <TextField
            label="Location"
            disabled={!canEdit}
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Start Date"
            type="date"
            required
            disabled={!canEdit}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <TextField
            label="End Date"
            type="date"
            disabled={!canEdit}
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Status"
            options={STATUS_OPTIONS}
            disabled={!canEdit}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}
          />
          {isEdit && (
            <TextField
              label="Progress %"
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={form.progress}
              onChange={(e) => setForm({ ...form, progress: e.target.value })}
            />
          )}
        </div>

        {isEdit && (
          <p className="text-xs text-ink-faint">
            Manager: {managerName || 'Unassigned'} — manager assignment isn&apos;t editable here yet (no
            admin user-picker endpoint exists).
          </p>
        )}

        <TextareaField
          label="Description"
          disabled={!canEdit}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/projects')}>
            {canEdit ? 'Cancel' : 'Back'}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Project'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
