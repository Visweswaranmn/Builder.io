import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { TextField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as invoicesApi from '@/lib/api/invoices';
import * as projectsApi from '@/lib/api/projects';
import type { Project } from '@/types/models';

interface ItemRow {
  description: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ITEM: ItemRow = { description: '', quantity: '1', unitPrice: '' };

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);

  const [project, setProject] = useState('');
  const [client, setClient] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<ItemRow[]>([{ ...EMPTY_ITEM }]);

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    invoicesApi
      .getInvoice(id)
      .then((inv) => {
        setProject(inv.project?._id ?? '');
        setClient(inv.client);
        setGstRate(String(inv.gstRate));
        setDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : '');
        setItems(inv.items.map((i) => ({ description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) })));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [id]);

  if (user && user.role !== 'super_admin') {
    return <Navigate to="/invoices" replace />;
  }

  const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const gstAmount = Math.round(subtotal * ((Number(gstRate) || 0) / 100) * 100) / 100;
  const total = subtotal + gstAmount;

  function updateItem(index: number, field: keyof ItemRow, value: string) {
    setItems((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload = {
      project,
      client,
      gstRate: Number(gstRate),
      dueDate: dueDate || undefined,
      items: items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
      })),
    };

    try {
      if (isEdit && id) {
        await invoicesApi.updateInvoice(id, payload);
        navigate(`/invoices/${id}`);
      } else {
        const created = await invoicesApi.createInvoice(payload);
        navigate(`/invoices/${created._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Invoice' : 'New Invoice'} />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Project"
            required
            placeholder="Select a project"
            options={projects.map((p) => ({ value: p._id, label: p.name }))}
            value={project}
            onChange={(e) => setProject(e.target.value)}
          />
          <TextField label="Client" required value={client} onChange={(e) => setClient(e.target.value)} />
          <TextField label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-ink">Line Items</label>
            <button type="button" onClick={addItem} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              + Add item
            </button>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label={index === 0 ? 'Description' : ''}
                    required
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                  />
                </div>
                <div className="w-20">
                  <TextField
                    label={index === 0 ? 'Qty' : ''}
                    type="number"
                    min={0}
                    required
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                  />
                </div>
                <div className="w-32">
                  <TextField
                    label={index === 0 ? 'Unit Price' : ''}
                    type="number"
                    min={0}
                    required
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                  />
                </div>
                <div className="w-28 pb-2 text-right text-sm text-ink-muted">
                  {((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toLocaleString('en-IN')}
                </div>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(index)} className="pb-2 text-xs text-red-600 hover:text-red-700">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="GST Rate %" type="number" min={0} max={100} value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
        </div>

        <div className="rounded-md bg-slate-50 p-4 text-sm">
          <div className="flex justify-between text-ink-muted">
            <span>Subtotal</span>
            <span>{subtotal.toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between text-ink-muted">
            <span>GST ({gstRate || 0}%)</span>
            <span>{gstAmount.toLocaleString('en-IN')}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-slate-200 pt-1 font-semibold text-ink">
            <span>Total</span>
            <span>{total.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Invoice'}
          </Button>
        </div>
      </form>
    </div>
  );
}
