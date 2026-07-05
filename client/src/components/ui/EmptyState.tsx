import { Inbox } from 'lucide-react';

export default function EmptyState({ message = 'Nothing here yet.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-14 text-center">
      <Inbox className="h-8 w-8 text-slate-300" strokeWidth={1.5} />
      <p className="text-sm text-ink-faint">{message}</p>
    </div>
  );
}
