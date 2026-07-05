import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Alert from '@/components/ui/Alert';
import { TextField, TextareaField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as expensesApi from '@/lib/api/expenses';
import * as projectsApi from '@/lib/api/projects';
import * as vendorsApi from '@/lib/api/vendors';
import type { ExpenseCategory, PaymentMethod, Project, Vendor } from '@/types/models';

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'labour', label: 'Labour' },
  { value: 'transport', label: 'Transport' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function ExpenseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEdit = user?.role === 'super_admin';

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [form, setForm] = useState({
    project: '',
    category: 'material' as ExpenseCategory,
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10),
    vendor: '',
    paymentMethod: 'cash' as PaymentMethod,
  });

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
    vendorsApi.listVendors({ limit: 100 }).then((r) => setVendors(r.vendors)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    expensesApi
      .getExpense(id)
      .then((e) => {
        setForm({
          project: e.project?._id ?? '',
          category: e.category,
          amount: String(e.amount),
          description: e.description ?? '',
          date: e.date.slice(0, 10),
          vendor: e.vendor?._id ?? '',
          paymentMethod: e.paymentMethod ?? 'cash',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load expense'))
      .finally(() => setLoading(false));
  }, [id]);

  if (!isEdit && !canEdit) {
    return <Navigate to="/expenses" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      project: form.project,
      category: form.category,
      amount: Number(form.amount),
      description: form.description || undefined,
      date: form.date || undefined,
      vendor: form.vendor || undefined,
      paymentMethod: form.paymentMethod,
    };

    try {
      if (isEdit && id) {
        await expensesApi.updateExpense(id, payload);
      } else {
        await expensesApi.createExpense(payload);
      }
      navigate('/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Expense' : 'New Expense'} />

      {!canEdit && <Alert tone="info">Only a Super Admin can change expense records. Viewing read-only.</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
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
            label="Category"
            disabled={!canEdit}
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Amount" type="number" min={0} required disabled={!canEdit} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField label="Date" type="date" disabled={!canEdit} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Vendor"
            placeholder="None"
            disabled={!canEdit}
            options={vendors.map((v) => ({ value: v._id, label: v.name }))}
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
          <SelectField
            label="Payment Method"
            disabled={!canEdit}
            options={PAYMENT_METHOD_OPTIONS}
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
          />
        </div>

        <TextareaField label="Description" disabled={!canEdit} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/expenses')}>
            {canEdit ? 'Cancel' : 'Back'}
          </Button>
          {canEdit && (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Expense'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
