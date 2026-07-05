import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { TextField, SelectField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as materialsApi from '@/lib/api/materials';
import * as projectsApi from '@/lib/api/projects';
import * as vendorsApi from '@/lib/api/vendors';
import type { MaterialCategory, Project, Vendor } from '@/types/models';

const CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: 'cement', label: 'Cement' },
  { value: 'steel', label: 'Steel' },
  { value: 'sand', label: 'Sand' },
  { value: 'bricks', label: 'Bricks' },
  { value: 'paint', label: 'Paint' },
  { value: 'other', label: 'Other' },
];

export default function MaterialForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [form, setForm] = useState({
    name: '',
    category: 'other' as MaterialCategory,
    unit: '',
    quantityInStock: '',
    lowStockThreshold: '',
    unitPrice: '',
    vendor: '',
    project: '',
  });

  useEffect(() => {
    projectsApi.listProjects({ limit: 100 }).then((r) => setProjects(r.projects)).catch(() => {});
    vendorsApi.listVendors({ limit: 100 }).then((r) => setVendors(r.vendors)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id) return;
    materialsApi
      .getMaterial(id)
      .then((m) => {
        setForm({
          name: m.name,
          category: m.category,
          unit: m.unit,
          quantityInStock: String(m.quantityInStock),
          lowStockThreshold: String(m.lowStockThreshold),
          unitPrice: String(m.unitPrice),
          vendor: m.vendor?._id ?? '',
          project: m.project?._id ?? '',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load material'))
      .finally(() => setLoading(false));
  }, [id]);

  if (user && user.role !== 'super_admin') {
    return <Navigate to="/materials" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      unit: form.unit,
      lowStockThreshold: form.lowStockThreshold ? Number(form.lowStockThreshold) : undefined,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
      vendor: form.vendor || undefined,
      project: form.project || undefined,
    };
    if (!isEdit) payload.quantityInStock = form.quantityInStock ? Number(form.quantityInStock) : undefined;

    try {
      if (isEdit && id) {
        await materialsApi.updateMaterial(id, payload);
      } else {
        await materialsApi.createMaterial(payload);
      }
      navigate('/materials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save material');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Material' : 'New Material'} />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <SelectField
            label="Category"
            options={CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as MaterialCategory })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Unit" placeholder="bag, ton, m3…" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <TextField
            label="Unit Price"
            type="number"
            min={0}
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {!isEdit && (
            <TextField
              label="Initial Quantity"
              type="number"
              min={0}
              value={form.quantityInStock}
              onChange={(e) => setForm({ ...form, quantityInStock: e.target.value })}
            />
          )}
          <TextField
            label="Low Stock Threshold"
            type="number"
            min={0}
            value={form.lowStockThreshold}
            onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Vendor"
            placeholder="None"
            options={vendors.map((v) => ({ value: v._id, label: v.name }))}
            value={form.vendor}
            onChange={(e) => setForm({ ...form, vendor: e.target.value })}
          />
          <SelectField
            label="Project"
            placeholder="None"
            options={projects.map((p) => ({ value: p._id, label: p.name }))}
            value={form.project}
            onChange={(e) => setForm({ ...form, project: e.target.value })}
          />
        </div>

        {isEdit && (
          <p className="text-xs text-ink-faint">
            Stock quantity isn&apos;t edited here — use Stock In/Out on the material&apos;s detail page.
          </p>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/materials')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Material'}
          </Button>
        </div>
      </form>
    </div>
  );
}
