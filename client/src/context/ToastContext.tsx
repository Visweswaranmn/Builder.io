import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TONE_CONFIG: Record<ToastTone, { classes: string; icon: typeof Info }> = {
  success: { classes: 'bg-ink text-white', icon: CheckCircle2 },
  error: { classes: 'bg-red-600 text-white', icon: XCircle },
  info: { classes: 'bg-ink text-white', icon: Info },
};

let nextId = 1;

/** Global toast notifications — call `useToast().showToast(...)` from anywhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => {
          const { classes, icon: Icon } = TONE_CONFIG[toast.tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm shadow-lg animate-fade-in ${classes}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {toast.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
