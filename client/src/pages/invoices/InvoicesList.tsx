import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import { SelectField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import * as invoicesApi from '@/lib/api/invoices';
import type { Invoice, InvoiceStatus, PaginationMeta } from '@/types/models';

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function InvoicesList() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await invoicesApi.listInvoices({
        page,
        status: (status || undefined) as InvoiceStatus | undefined,
      });
      setInvoices(result.invoices);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', label: 'Invoice #', render: (i) => <span className="font-medium text-ink">{i.invoiceNumber}</span> },
    { key: 'client', label: 'Client' },
    { key: 'project', label: 'Project', render: (i) => i.project?.name ?? '—' },
    { key: 'total', label: 'Total', render: (i) => i.total.toLocaleString('en-IN') },
    { key: 'status', label: 'Status', render: (i) => <Badge tone={statusTone(i.status)}>{i.status.replace('_', ' ')}</Badge> },
    { key: 'issueDate', label: 'Issued', render: (i) => new Date(i.issueDate).toLocaleDateString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Billing, GST, payments, and outstanding balances."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/invoices/new')}>+ New Invoice</Button>
          </RoleGate>
        }
      />

      <div className="w-56">
        <SelectField
          label="Status"
          placeholder="All statuses"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={invoices}
        loading={loading}
        rowKey={(i) => i._id}
        onRowClick={(i) => navigate(`/invoices/${i._id}`)}
        emptyMessage="No invoices found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
