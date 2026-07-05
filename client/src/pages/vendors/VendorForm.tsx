import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import { TextField } from '@/components/ui/FormField';
import { useAuth } from '@/context/AuthContext';
import * as vendorsApi from '@/lib/api/vendors';

export default function VendorForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    gstNumber: '',
    materialsSupplied: '',
  });

  useEffect(() => {
    if (!id) return;
    vendorsApi
      .getVendor(id)
      .then((v) => {
        setForm({
          name: v.name,
          companyName: v.companyName ?? '',
          email: v.email ?? '',
          phone: v.phone ?? '',
          address: v.address ?? '',
          gstNumber: v.gstNumber ?? '',
          materialsSupplied: v.materialsSupplied.join(', '),
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load vendor'))
      .finally(() => setLoading(false));
  }, [id]);

  if (user && user.role !== 'super_admin') {
    return <Navigate to="/vendors" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const payload: Record<string, unknown> = {
      name: form.name,
      companyName: form.companyName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      gstNumber: form.gstNumber || undefined,
      materialsSupplied: form.materialsSupplied
        ? form.materialsSupplied.split(',').map((s) => s.trim()).filter(Boolean)
        : undefined,
    };

    try {
      if (isEdit && id) {
        await vendorsApi.updateVendor(id, payload);
      } else {
        await vendorsApi.createVendor(payload);
      }
      navigate('/vendors');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save vendor');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={isEdit ? 'Edit Vendor' : 'New Vendor'} />

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-panel p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Company Name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <TextField label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>

        <TextField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="GST Number" value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
          <TextField
            label="Materials Supplied"
            placeholder="cement, steel, sand"
            value={form.materialsSupplied}
            onChange={(e) => setForm({ ...form, materialsSupplied: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/vendors')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Vendor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
