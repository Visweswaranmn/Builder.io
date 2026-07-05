import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { TextField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as usersApi from '@/lib/api/users';
import type { UserRole } from '@/types/auth';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'accountant', label: 'Accountant' },
];

export default function UserForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'site_engineer' as UserRole,
    isActive: true,
  });

  useEffect(() => {
    if (!id) return;
    usersApi
      .getUser(id)
      .then((u) => {
        setForm({
          name: u.name,
          email: u.email,
          password: '',
          phone: u.phone ?? '',
          role: u.role,
          isActive: u.isActive,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load user'))
      .finally(() => setLoading(false));
  }, [id]);

  if (currentUser && currentUser.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (isEdit && id) {
        await usersApi.updateUser(id, {
          name: form.name,
          phone: form.phone || undefined,
          role: form.role,
          isActive: form.isActive,
        });
      } else {
        await usersApi.createUser({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          role: form.role,
        });
      }
      navigate('/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit User' : 'New User'} description="Choose the role this account should have access as." />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Full Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField
            label="Email"
            type="email"
            required
            disabled={isEdit}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <TextField
              label="Password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
          )}
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Role"
            required
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          />
          {isEdit && (
            <SelectField
              label="Status"
              options={[
                { value: 'true', label: 'Active' },
                { value: 'false', label: 'Inactive' },
              ]}
              value={String(form.isActive)}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
            />
          )}
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/users')}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </div>
      </form>
    </div>
  );
}
