import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import RoleGate from '@/components/RoleGate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import DataTable, { type Column } from '@/components/ui/DataTable';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SelectField } from '@/components/ui/FormField';
import * as expensesApi from '@/lib/api/expenses';
import type { Expense, ExpenseCategory, PaginationMeta } from '@/types/models';

const CATEGORY_OPTIONS: { value: ExpenseCategory; label: string }[] = [
  { value: 'material', label: 'Material' },
  { value: 'labour', label: 'Labour' },
  { value: 'transport', label: 'Transport' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

export default function ExpensesList() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await expensesApi.listExpenses({
        page,
        category: (category || undefined) as ExpenseCategory | undefined,
      });
      setExpenses(result.expenses);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category]);

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await expensesApi.deleteExpense(pendingDelete._id);
      setPendingDelete(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete expense');
      setPendingDelete(null);
    }
  }

  const columns: Column<Expense>[] = [
    { key: 'date', label: 'Date', render: (e) => new Date(e.date).toLocaleDateString() },
    { key: 'project', label: 'Project', render: (e) => e.project?.name ?? '—' },
    { key: 'category', label: 'Category', render: (e) => <Badge tone="blue">{e.category}</Badge> },
    { key: 'amount', label: 'Amount', render: (e) => e.amount.toLocaleString('en-IN') },
    { key: 'vendor', label: 'Vendor', render: (e) => e.vendor?.name ?? '—' },
    { key: 'description', label: 'Description' },
    {
      key: 'actions',
      label: '',
      render: (e) => (
        <RoleGate roles={['super_admin']}>
          <button
            onClick={(ev) => {
              ev.stopPropagation();
              setPendingDelete(e);
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
        title="Expenses"
        description="Material, labour, transport, and other project costs."
        actions={
          <RoleGate roles={['super_admin']}>
            <Button onClick={() => navigate('/expenses/new')}>+ New Expense</Button>
          </RoleGate>
        }
      />

      <div className="w-48">
        <SelectField
          label="Category"
          placeholder="All categories"
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <DataTable
        columns={columns}
        rows={expenses}
        loading={loading}
        rowKey={(e) => e._id}
        onRowClick={(e) => navigate(`/expenses/${e._id}/edit`)}
        emptyMessage="No expenses found."
      />
      {meta && <Pagination meta={meta} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete expense"
          message="Delete this expense? This cannot be undone."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
