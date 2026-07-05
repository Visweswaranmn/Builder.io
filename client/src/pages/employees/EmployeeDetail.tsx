import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import * as employeesApi from '@/lib/api/employees';
import type { Employee, AttendanceEntry, AttendanceStatus } from '@/types/models';

const ATTENDANCE_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave', label: 'Leave' },
];

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    status: 'present' as AttendanceStatus,
    note: '',
  });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setEmployee(await employeesApi.getEmployee(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleMarkAttendance(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await employeesApi.markAttendance(id, attendanceForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record attendance');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;
  if (!employee) return <p className="text-sm text-red-600">{error || 'Employee not found'}</p>;

  const sortedAttendance = [...employee.attendance].sort((a, b) => b.date.localeCompare(a.date));

  const attendanceColumns: Column<AttendanceEntry>[] = [
    { key: 'date', label: 'Date', render: (a) => new Date(a.date).toLocaleDateString() },
    { key: 'status', label: 'Status', render: (a) => <Badge tone={statusTone(a.status)}>{a.status.replace('_', ' ')}</Badge> },
    { key: 'note', label: 'Note', render: (a) => a.note ?? '—' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={employee.name}
        description={`${employee.designation ?? employee.department} · ${employee.project?.name ?? 'Unassigned'}`}
        actions={
          <RoleGate roles={['super_admin']}>
            <Button variant="secondary" onClick={() => navigate(`/employees/${employee._id}/edit`)}>
              Edit
            </Button>
          </RoleGate>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-panel p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-faint">Department</p>
          <p className="capitalize text-ink">{employee.department}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Salary</p>
          <p className="text-ink">{employee.salary.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Status</p>
          <Badge tone={employee.isActive ? 'green' : 'slate'}>{employee.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Manager</p>
          <p className="text-ink">{employee.manager?.name ?? '—'}</p>
        </div>
      </div>

      <RoleGate roles={['super_admin', 'project_manager']}>
        <form onSubmit={handleMarkAttendance} className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="text-sm font-semibold text-ink">Mark Attendance</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <TextField
              label="Date"
              type="date"
              value={attendanceForm.date}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
            />
            <SelectField
              label="Status"
              options={ATTENDANCE_OPTIONS}
              value={attendanceForm.status}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value as AttendanceStatus })}
            />
            <TextField
              label="Note"
              value={attendanceForm.note}
              onChange={(e) => setAttendanceForm({ ...attendanceForm, note: e.target.value })}
            />
            <div className="flex items-end">
              <Button type="submit" disabled={submitting} className="w-full justify-center">
                {submitting ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </RoleGate>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Attendance History</h2>
        <DataTable columns={attendanceColumns} rows={sortedAttendance} rowKey={(a) => a.date} emptyMessage="No attendance recorded yet." />
      </div>
    </div>
  );
}
