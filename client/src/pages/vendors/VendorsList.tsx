import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TextField } from '@/components/ui/FormField';
import { statusTone } from '@/lib/statusTone';
import * as vendorsApi from '@/lib/api/vendors';
import type { Vendor, PaginationMeta } from '@/types/models';

export default function VendorsList() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Vendor | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await vendorsApi.listVendors({ page, search: search || undefined });
      setVendors(result.vendors);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await vendorsApi.deleteVendor(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vendor');
      setPendingDelete(null);
    }
  }

  const columns: Column<Vendor>[] = [
    { key: 'name', label: 'Vendor', render: (v) => <span className="font-medium text-ink">{v.name}</span> },
    { key: 'companyName', label: 'Company' },
    { key: 'phone', label: 'Phone' },
    { key: 'outstandingBalance', label: 'Outstanding', render: (v) => v.outstandingBalance.toLocaleString('en-IN') },
    { key: 'paymentStatus', label: 'Payment Status', render: (v) => <Badge tone={statusTone(v.paymentStatus)}>{v.paymentStatus}</Badge> },
    {
      key: 'actions',
      label: '',
      render: (v) => (
        <RoleGate roles={['super_admin']}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPendingDelete(v);
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
        title="Vendors"
        description="Suppliers, purchase orders, and payment history."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/vendors/new')}>+ New Vendor</Button>
          </RoleGate>
        }
      />

      <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <TextField label="Search" placeholder="Vendor or company name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={vendors}
        loading={loading}
        rowKey={(v) => v._id}
        onRowClick={(v) => navigate(`/vendors/${v._id}`)}
        emptyMessage="No vendors found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete vendor"
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
