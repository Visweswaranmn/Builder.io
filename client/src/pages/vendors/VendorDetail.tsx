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
import * as vendorsApi from '@/lib/api/vendors';
import type { Vendor, PurchaseOrder, VendorPayment, PurchaseOrderStatus, PaymentMethod } from '@/types/models';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

const NEXT_STATUS: Partial<Record<PurchaseOrderStatus, { label: string; next: PurchaseOrderStatus }[]>> = {
  pending: [
    { label: 'Mark Ordered', next: 'ordered' },
    { label: 'Cancel', next: 'cancelled' },
  ],
  ordered: [
    { label: 'Mark Delivered', next: 'delivered' },
    { label: 'Cancel', next: 'cancelled' },
  ],
};

export default function VendorDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingPo, setSubmittingPo] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [poForm, setPoForm] = useState({ description: '', amount: '' });
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer' as PaymentMethod, note: '' });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setVendor(await vendorsApi.getVendor(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendor');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddPo(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmittingPo(true);
    setError('');
    try {
      await vendorsApi.addPurchaseOrder(id, { description: poForm.description, amount: Number(poForm.amount) });
      setPoForm({ description: '', amount: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    } finally {
      setSubmittingPo(false);
    }
  }

  async function handlePoStatus(poId: string, status: PurchaseOrderStatus) {
    if (!id) return;
    setError('');
    try {
      await vendorsApi.updatePurchaseOrderStatus(id, poId, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update purchase order');
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmittingPayment(true);
    setError('');
    try {
      await vendorsApi.recordVendorPayment(id, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        note: paymentForm.note || undefined,
      });
      setPaymentForm({ amount: '', method: 'bank_transfer', note: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  }

  if (loading) return <Spinner />;
  if (!vendor) return <p className="text-sm text-red-600">{error || 'Vendor not found'}</p>;

  const poColumns: Column<PurchaseOrder>[] = [
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount', render: (po) => po.amount.toLocaleString('en-IN') },
    { key: 'status', label: 'Status', render: (po) => <Badge tone={statusTone(po.status)}>{po.status}</Badge> },
    { key: 'orderDate', label: 'Ordered', render: (po) => new Date(po.orderDate).toLocaleDateString() },
    {
      key: 'actions',
      label: '',
      render: (po) => (
        <RoleGate roles={['super_admin']}>
          <div className="flex gap-2">
            {(NEXT_STATUS[po.status] ?? []).map((action) => (
              <button
                key={action.next}
                onClick={() => handlePoStatus(po._id, action.next)}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                {action.label}
              </button>
            ))}
          </div>
        </RoleGate>
      ),
    },
  ];

  const paymentColumns: Column<VendorPayment>[] = [
    { key: 'date', label: 'Date', render: (p) => new Date(p.date).toLocaleDateString() },
    { key: 'amount', label: 'Amount', render: (p) => p.amount.toLocaleString('en-IN') },
    { key: 'method', label: 'Method', render: (p) => <span className="capitalize">{p.method.replace('_', ' ')}</span> },
    { key: 'note', label: 'Note', render: (p) => p.note ?? '—' },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={vendor.name}
        description={vendor.companyName}
        actions={
          <RoleGate roles={['super_admin']}>
            <Button variant="secondary" onClick={() => navigate(`/vendors/${vendor._id}/edit`)}>
              Edit
            </Button>
          </RoleGate>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-panel p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-faint">Phone</p>
          <p className="text-ink">{vendor.phone ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Outstanding Balance</p>
          <p className="text-ink">{vendor.outstandingBalance.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Payment Status</p>
          <Badge tone={statusTone(vendor.paymentStatus)}>{vendor.paymentStatus}</Badge>
        </div>
        <div>
          <p className="text-xs text-ink-faint">GST Number</p>
          <p className="text-ink">{vendor.gstNumber ?? '—'}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Purchase Orders</h2>
        <RoleGate roles={['super_admin']}>
          <form onSubmit={handleAddPo} className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-panel p-4">
            <div className="w-64">
              <TextField label="Description" required value={poForm.description} onChange={(e) => setPoForm({ ...poForm, description: e.target.value })} />
            </div>
            <div className="w-40">
              <TextField label="Amount" type="number" min={0} required value={poForm.amount} onChange={(e) => setPoForm({ ...poForm, amount: e.target.value })} />
            </div>
            <Button type="submit" disabled={submittingPo}>
              {submittingPo ? 'Saving…' : 'Add Purchase Order'}
            </Button>
          </form>
        </RoleGate>
        <DataTable columns={poColumns} rows={vendor.purchaseOrders} rowKey={(po) => po._id} emptyMessage="No purchase orders yet." />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Payments</h2>
        <RoleGate roles={['super_admin']}>
          <form onSubmit={handleRecordPayment} className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-panel p-4">
            <div className="w-40">
              <TextField label="Amount" type="number" min={0} required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
            </div>
            <div className="w-48">
              <SelectField
                label="Method"
                options={PAYMENT_METHOD_OPTIONS}
                value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
              />
            </div>
            <div className="w-56">
              <TextField label="Note" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
            </div>
            <Button type="submit" disabled={submittingPayment}>
              {submittingPayment ? 'Saving…' : 'Record Payment'}
            </Button>
          </form>
        </RoleGate>
        <DataTable columns={paymentColumns} rows={vendor.payments} rowKey={(p) => `${p.date}-${p.amount}`} emptyMessage="No payments recorded yet." />
      </div>
    </div>
  );
}
