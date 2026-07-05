import { useEffect, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { SelectField } from '@/components/ui/FormField';
import * as notificationsApi from '@/lib/api/notifications';
import type { AppNotification, NotificationType, PaginationMeta } from '@/types/models';

const TYPE_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'material_low', label: 'Material Low' },
  { value: 'task_assigned', label: 'Task Assigned' },
  { value: 'deadline_reminder', label: 'Deadline Reminder' },
  { value: 'expense_limit', label: 'Expense Limit' },
  { value: 'general', label: 'General' },
];

const READ_OPTIONS = [
  { value: 'false', label: 'Unread' },
  { value: 'true', label: 'Read' },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');
  const [isRead, setIsRead] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const result = await notificationsApi.listNotifications({
        page,
        type: (type || undefined) as NotificationType | undefined,
        isRead: isRead === '' ? undefined : isRead === 'true',
      });
      setNotifications(result.notifications);
      setMeta(result.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, type, isRead]);

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as read');
    }
  }

  async function handleDelete(id: string) {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete notification');
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllAsRead();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all as read');
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Alerts about low stock, task assignments, deadlines, and budget limits."
        actions={<Button variant="secondary" onClick={handleMarkAllRead}>Mark all read</Button>}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <SelectField label="Type" placeholder="All types" options={TYPE_OPTIONS} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} />
        </div>
        <div className="w-40">
          <SelectField label="Status" placeholder="All" options={READ_OPTIONS} value={isRead} onChange={(e) => { setIsRead(e.target.value); setPage(1); }} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <Spinner />
      ) : notifications.length === 0 ? (
        <EmptyState message="No notifications." />
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-panel">
          {notifications.map((n) => (
            <div key={n._id} className={`flex items-start justify-between gap-4 px-4 py-3 ${n.isRead ? '' : 'bg-brand-50/40'}`}>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  <Badge tone="slate">{n.type.replace('_', ' ')}</Badge>
                  {!n.isRead && <Badge tone="blue">new</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink-muted">{n.message}</p>
                <p className="mt-1 text-xs text-ink-faint">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                {!n.isRead && (
                  <button onClick={() => handleMarkRead(n._id)} className="text-xs font-medium text-brand-600 hover:text-brand-700">
                    Mark read
                  </button>
                )}
                <button onClick={() => handleDelete(n._id)} className="text-xs font-medium text-red-600 hover:text-red-700">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {meta && <Pagination meta={meta} onPageChange={setPage} />}
    </div>
  );
}
