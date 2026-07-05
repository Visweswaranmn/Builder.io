import type { ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

type Tone = 'success' | 'warning' | 'error' | 'info';

const TONE_CONFIG: Record<Tone, { classes: string; icon: typeof Info }> = {
  success: { classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200', icon: CheckCircle2 },
  warning: { classes: 'bg-amber-50 text-amber-800 ring-amber-200', icon: AlertTriangle },
  error: { classes: 'bg-red-50 text-red-800 ring-red-200', icon: XCircle },
  info: { classes: 'bg-blue-50 text-blue-800 ring-blue-200', icon: Info },
};

/** Inline banner for persistent page-level messages (validation summaries, form errors). */
export default function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  const { classes, icon: Icon } = TONE_CONFIG[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm ring-1 ring-inset ${classes}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
