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
import * as employeesApi from '@/lib/api/employees';
import type { Employee, Department, PaginationMeta } from '@/types/models';

const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'management', label: 'Management' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

export default function EmployeesList() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await employeesApi.listEmployees({
        page,
        department: (department || undefined) as Department | undefined,
        search: search || undefined,
      });
      setEmployees(result.employees);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, department]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await employeesApi.deleteEmployee(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee');
      setPendingDelete(null);
    }
  }

  const columns: Column<Employee>[] = [
    { key: 'name', label: 'Name', render: (e) => <span className="font-medium text-ink">{e.name}</span> },
    { key: 'department', label: 'Department', render: (e) => <span className="capitalize">{e.department}</span> },
    { key: 'designation', label: 'Designation' },
    { key: 'project', label: 'Project', render: (e) => e.project?.name ?? '—' },
    { key: 'salary', label: 'Salary', render: (e) => e.salary.toLocaleString('en-IN') },
    { key: 'isActive', label: 'Status', render: (e) => <Badge tone={e.isActive ? 'green' : 'slate'}>{e.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (e) => (
        <RoleGate roles={['super_admin']}>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setPendingDelete(e);
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
        title="Employees"
        description="Workforce, assignments, and attendance."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/employees/new')}>+ New Employee</Button>
          </RoleGate>
        }
      />

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <TextField label="Search" placeholder="Name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <SelectField
            label="Department"
            placeholder="All departments"
            options={DEPARTMENT_OPTIONS}
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
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
        rows={employees}
        loading={loading}
        rowKey={(e) => e._id}
        onRowClick={(e) => navigate(`/employees/${e._id}`)}
        emptyMessage="No employees found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete employee"
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
