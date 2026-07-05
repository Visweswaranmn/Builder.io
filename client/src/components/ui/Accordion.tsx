import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-panel">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink hover:bg-panel-hover"
      >
        {title}
        <ChevronDown className={`h-4 w-4 text-ink-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-slate-200 bg-slate-100 px-4 py-3 animate-fade-in">{children}</div>}
    </div>
  );
}
