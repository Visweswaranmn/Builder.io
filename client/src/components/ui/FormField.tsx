import { useId, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const FIELD_CLASS =
  'mt-1.5 w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-brand-500 focus:bg-panel focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-ink-faint';

function Wrapper({
  htmlFor,
  label,
  required,
  error,
  children,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function TextField({
  id,
  label,
  required,
  error,
  className = '',
  ...props
}: { id?: string; label: string; required?: boolean; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper htmlFor={fieldId} label={label} required={required} error={error}>
      <input id={fieldId} className={`${FIELD_CLASS} ${className}`} {...props} />
    </Wrapper>
  );
}

export function TextareaField({
  id,
  label,
  required,
  error,
  className = '',
  ...props
}: { id?: string; label: string; required?: boolean; error?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper htmlFor={fieldId} label={label} required={required} error={error}>
      <textarea id={fieldId} className={`${FIELD_CLASS} ${className}`} rows={3} {...props} />
    </Wrapper>
  );
}

export function SelectField({
  id,
  label,
  required,
  error,
  options,
  placeholder,
  className = '',
  ...props
}: {
  id?: string;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  options: { value: string; label: string }[];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <Wrapper htmlFor={fieldId} label={label} required={required} error={error}>
      <div className="relative">
        <select id={fieldId} className={`${FIELD_CLASS} appearance-none pr-9 ${className}`} {...props}>
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      </div>
    </Wrapper>
  );
}
