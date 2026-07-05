import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import DataTable, { type Column } from '@/components/ui/DataTable';
import { SelectField, TextField } from '@/components/ui/FormField';
import * as materialsApi from '@/lib/api/materials';
import type { Material, StockTransaction, StockTxnType } from '@/types/models';

export default function MaterialDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [txnForm, setTxnForm] = useState({ type: 'in' as StockTxnType, quantity: '', note: '' });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setMaterial(await materialsApi.getMaterial(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load material');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmitting(true);
    setError('');
    try {
      await materialsApi.addStockTransaction(id, {
        type: txnForm.type,
        quantity: Number(txnForm.quantity),
        note: txnForm.note || undefined,
      });
      setTxnForm({ type: 'in', quantity: '', note: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record stock movement');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Spinner />;
  if (!material) return <p className="text-sm text-red-600">{error || 'Material not found'}</p>;

  const sortedTxns = [...material.transactions].sort((a, b) => b.date.localeCompare(a.date));

  const txnColumns: Column<StockTransaction>[] = [
    { key: 'date', label: 'Date', render: (t) => new Date(t.date).toLocaleDateString() },
    { key: 'type', label: 'Type', render: (t) => <Badge tone={t.type === 'in' ? 'green' : 'amber'}>{t.type}</Badge> },
    { key: 'quantity', label: 'Quantity', render: (t) => `${t.quantity} ${material.unit}` },
    { key: 'note', label: 'Note', render: (t) => t.note ?? '—' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={material.name}
        description={`${material.category} · ${material.vendor?.name ?? 'No vendor'} · ${material.project?.name ?? 'Unassigned'}`}
        actions={
          <RoleGate roles={['super_admin']}>
            <Button variant="secondary" onClick={() => navigate(`/materials/${material._id}/edit`)}>
              Edit
            </Button>
          </RoleGate>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-panel p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-faint">In Stock</p>
          <p className="text-ink">{material.quantityInStock} {material.unit}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Threshold</p>
          <p className="text-ink">{material.lowStockThreshold} {material.unit}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Unit Price</p>
          <p className="text-ink">{material.unitPrice.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Status</p>
          {material.isLowStock ? <Badge tone="red">Low stock</Badge> : <Badge tone="green">OK</Badge>}
        </div>
      </div>

      <RoleGate roles={['super_admin', 'project_manager', 'site_engineer']}>
        <form onSubmit={handleStockSubmit} className="rounded-lg border border-slate-200 bg-panel p-5">
          <h2 className="text-sm font-semibold text-ink">Record Stock Movement</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <SelectField
              label="Type"
              options={[
                { value: 'in', label: 'Stock In' },
                { value: 'out', label: 'Stock Out' },
              ]}
              value={txnForm.type}
              onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value as StockTxnType })}
            />
            <TextField
              label="Quantity"
              type="number"
              min={0}
              required
              value={txnForm.quantity}
              onChange={(e) => setTxnForm({ ...txnForm, quantity: e.target.value })}
            />
            <TextField label="Note" value={txnForm.note} onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })} />
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
        <h2 className="mb-2 text-sm font-semibold text-ink">Transaction History</h2>
        <DataTable columns={txnColumns} rows={sortedTxns} rowKey={(t) => `${t.date}-${t.type}-${t.quantity}`} emptyMessage="No stock movements yet." />
      </div>
    </div>
  );
}
