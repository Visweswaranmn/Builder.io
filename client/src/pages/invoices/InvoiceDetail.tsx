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
import * as invoicesApi from '@/lib/api/invoices';
import type { Invoice, InvoiceItem, InvoicePayment, PaymentMethod } from '@/types/models';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', method: 'bank_transfer' as PaymentMethod, reference: '' });

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      setInvoice(await invoicesApi.getInvoice(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleStatusChange(status: 'sent' | 'cancelled') {
    if (!id) return;
    setError('');
    try {
      await invoicesApi.updateInvoiceStatus(id, status);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  async function handleRecordPayment(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSubmittingPayment(true);
    setError('');
    try {
      await invoicesApi.recordInvoicePayment(id, {
        amount: Number(paymentForm.amount),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
      });
      setPaymentForm({ amount: '', method: 'bank_transfer', reference: '' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  }

  async function handleDownloadInvoice() {
    if (!invoice) return;
    try {
      await invoicesApi.downloadInvoicePdf(invoice._id, invoice.invoiceNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice PDF');
    }
  }

  async function handleDownloadReceipt(index: number) {
    if (!invoice) return;
    try {
      await invoicesApi.downloadReceiptPdf(invoice._id, index, invoice.invoiceNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download receipt');
    }
  }

  if (loading) return <Spinner />;
  if (!invoice) return <p className="text-sm text-red-600">{error || 'Invoice not found'}</p>;

  const itemColumns: Column<InvoiceItem>[] = [
    { key: 'description', label: 'Description' },
    { key: 'quantity', label: 'Qty' },
    { key: 'unitPrice', label: 'Unit Price', render: (i) => i.unitPrice.toLocaleString('en-IN') },
    { key: 'amount', label: 'Amount', render: (i) => i.amount.toLocaleString('en-IN') },
  ];

  const paymentColumns: Column<InvoicePayment & { index: number }>[] = [
    { key: 'date', label: 'Date', render: (p) => new Date(p.date).toLocaleDateString() },
    { key: 'amount', label: 'Amount', render: (p) => p.amount.toLocaleString('en-IN') },
    { key: 'method', label: 'Method', render: (p) => <span className="capitalize">{p.method.replace('_', ' ')}</span> },
    { key: 'reference', label: 'Reference', render: (p) => p.reference ?? '—' },
    {
      key: 'receipt',
      label: '',
      render: (p) => (
        <button onClick={() => handleDownloadReceipt(p.index)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
          Download Receipt
        </button>
      ),
    },
  ];

  const amountPaid = invoice.amountPaid ?? invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = invoice.balanceDue ?? Math.max(invoice.total - amountPaid, 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={invoice.invoiceNumber}
        description={`${invoice.client} · ${invoice.project?.name ?? ''}`}
        actions={
          <>
            <Button variant="secondary" onClick={handleDownloadInvoice}>
              Download PDF
            </Button>
            <RoleGate roles={['super_admin']}>
              <Button variant="secondary" onClick={() => navigate(`/invoices/${invoice._id}/edit`)}>
                Edit
              </Button>
            </RoleGate>
          </>
        }
      />

      <div className="flex items-center gap-3">
        <Badge tone={statusTone(invoice.status)}>{invoice.status.replace('_', ' ')}</Badge>
        <RoleGate roles={['super_admin']}>
          {invoice.status === 'draft' && (
            <button onClick={() => handleStatusChange('sent')} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Mark as Sent
            </button>
          )}
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button onClick={() => handleStatusChange('cancelled')} className="text-xs font-medium text-red-600 hover:text-red-700">
              Cancel Invoice
            </button>
          )}
        </RoleGate>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-panel p-5 sm:grid-cols-4">
        <div>
          <p className="text-xs text-ink-faint">Total</p>
          <p className="text-ink">{invoice.total.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Paid</p>
          <p className="text-ink">{amountPaid.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Balance Due</p>
          <p className="font-semibold text-ink">{balanceDue.toLocaleString('en-IN')}</p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">Due Date</p>
          <p className="text-ink">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Line Items</h2>
        <DataTable columns={itemColumns} rows={invoice.items} rowKey={(i) => i.description} emptyMessage="No items." />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Payments</h2>
        <RoleGate roles={['super_admin']}>
          {invoice.status !== 'cancelled' && balanceDue > 0 && (
            <form onSubmit={handleRecordPayment} className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-panel p-4">
              <div className="w-36">
                <TextField label="Amount" type="number" min={0} required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
              </div>
              <div className="w-44">
                <SelectField
                  label="Method"
                  options={PAYMENT_METHOD_OPTIONS}
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                />
              </div>
              <div className="w-48">
                <TextField label="Reference" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              </div>
              <Button type="submit" disabled={submittingPayment}>
                {submittingPayment ? 'Saving…' : 'Record Payment'}
              </Button>
            </form>
          )}
        </RoleGate>
        <DataTable
          columns={paymentColumns}
          rows={invoice.payments.map((p, index) => ({ ...p, index }))}
          rowKey={(p) => `${p.date}-${p.amount}`}
          emptyMessage="No payments recorded yet."
        />
      </div>
    </div>
  );
}
