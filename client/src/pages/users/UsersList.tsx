import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SelectField, TextField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as usersApi from '@/lib/api/users';
import type { AppUser, PaginationMeta } from '@/types/models';
import type { UserRole } from '@/types/auth';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'accountant', label: 'Accountant' },
];

export default function UsersList() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);
  const [error, setError] = useState('');
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await usersApi.listUsers({
        page,
        role: (role || undefined) as UserRole | undefined,
        search: search || undefined,
      });
      setUsers(result.users);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, role]);

  if (currentUser && currentUser.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await usersApi.deleteUser(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      setPendingDelete(null);
    }
  }

  async function handleRoleChange(target: AppUser, newRole: UserRole) {
    if (newRole === target.role) return;
    setSavingRoleId(target._id);
    setError('');
    try {
      const updated = await usersApi.updateUser(target._id, { role: newRole });
      setUsers((prev) => prev.map((u) => (u._id === target._id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  }

  const columns: Column<AppUser>[] = [
    { key: 'name', label: 'Name', render: (u) => <span className="font-medium text-ink">{u.name}</span> },
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (u) => (
        <div className="relative inline-block">
          <select
            value={u.role}
            disabled={savingRoleId === u._id || u._id === currentUser?.id}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
            className="rounded-lg border border-slate-300 bg-slate-100 py-1 pl-2 pr-7 text-xs font-medium text-ink transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: (u) => u.phone ?? '—' },
    {
      key: 'isActive',
      label: 'Status',
      render: (u) => (u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>),
    },
    {
      key: 'actions',
      label: '',
      render: (u) => (
        <div className="flex justify-end gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/${u._id}/edit`);
            }}
            className="text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Edit
          </button>
          {u._id !== currentUser?.id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPendingDelete(u);
              }}
              className="text-xs font-medium text-red-600 hover:text-red-700"
            >
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage login accounts and assign roles. Super Admin only."
        actions={<Button onClick={() => navigate('/users/new')}>+ New User</Button>}
      />

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <TextField label="Search" placeholder="Name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <SelectField
            label="Role"
            placeholder="All roles"
            options={ROLE_OPTIONS}
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable columns={columns} rows={users} loading={loading} rowKey={(u) => u._id} emptyMessage="No users found." />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete user"
          message={`Delete "${pendingDelete.name}"? They will immediately lose access.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
