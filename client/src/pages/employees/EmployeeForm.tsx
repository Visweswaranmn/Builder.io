import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { TextField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as employeesApi from '@/lib/api/employees';
import * as projectsApi from '@/lib/api/projects';
import type { Department, Project } from '@/types/models';

const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'management', label: 'Management' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

export default function EmployeeForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department: 'other' as Department,
    designation: '',
    salary: '',
    dateOfJoining: '',
    project: '',
    isActive: true,
  });

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    employeesApi
      .getEmployee(id)
      .then((e) => {
        setForm({
          name: e.name,
          email: e.email ?? '',
          phone: e.phone ?? '',
          department: e.department,
          designation: e.designation ?? '',
          salary: String(e.salary),
          dateOfJoining: e.dateOfJoining ? e.dateOfJoining.slice(0, 10) : '',
          project: e.project?._id ?? '',
          isActive: e.isActive,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load employee'))
      .finally(() => setLoading(false));
  }, [id]);

  if (user && user.role !== 'super_admin') {
    return <Navigate to="/employees" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email || undefined,
      phone: form.phone || undefined,
      department: form.department,
      designation: form.designation || undefined,
      salary: form.salary ? Number(form.salary) : undefined,
      dateOfJoining: form.dateOfJoining || undefined,
      project: form.project || undefined,
    };
    if (isEdit) payload.isActive = form.isActive;

    try {
      if (isEdit && id) {
        await employeesApi.updateEmployee(id, payload);
      } else {
        await employeesApi.createEmployee(payload);
      }
      navigate('/employees');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save employee');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Employee' : 'New Employee'} />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField label="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Department"
            options={DEPARTMENT_OPTIONS}
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value as Department })}
          />
          <SelectField
            label="Project"
            placeholder="Unassigned"
            options={projects.map((p) => ({ value: p._id, label: p.name }))}
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Salary"
            type="number"
            min={0}
            value={form.salary}
            onChange={(e) => setForm({ ...form, salary: e.target.value })}
          />
          <TextField
            label="Date of Joining"
            type="date"
            value={form.dateOfJoining}
            onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })}
          />
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-slate-300"
            />
            Active
          </label>
        )}

        <p className="text-xs text-ink-faint">
          Manager and login-account linking aren&apos;t editable here yet (no admin user-picker endpoint exists).
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/employees')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Employee'}
          </Button>
        </div>
      </form>
    </div>
  );
}
