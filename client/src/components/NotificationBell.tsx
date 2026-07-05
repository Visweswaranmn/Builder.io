import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import * as notificationsApi from '@/lib/api/notifications';
import { useToast } from '@/context/ToastContext';
import type { AppNotification } from '@/types/models';

export default function NotificationBell() {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [recent, setRecent] = useState<AppNotification[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    notificationsApi.getUnreadCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function toggle() {
    if (!open) {
      const { notifications } = await notificationsApi.listNotifications({ limit: 5 });
      setRecent(notifications);
    }
    setOpen((o) => !o);
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllAsRead();
    setCount(0);
    setRecent((prev) => prev.map((n) => ({ ...n, isRead: true })));
    showToast('All notifications marked as read', 'success');
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 text-white/70 transition-colors hover:bg-shell-hover hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-shell">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-slate-200 bg-panel shadow-lg animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            <button onClick={handleMarkAllRead} className="text-xs font-medium text-brand-600 hover:text-brand-700">
              Mark all read
            </button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No notifications</p>
            ) : (
              recent.map((n) => (
                <div key={n._id} className={`border-b border-slate-100 px-4 py-3 text-sm ${n.isRead ? '' : 'bg-brand-50/60'}`}>
                  <p className="font-medium text-ink">{n.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{n.message}</p>
                </div>
              ))
            )}
          </div>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-200 px-4 py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-100"
          >
            View all
          </Link>
        </div>
      )}
    </div>
  );
}
