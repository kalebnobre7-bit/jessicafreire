import { useLayoutEffect, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL = 'rounded-lg border border-line-strong bg-panel px-3 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 hover:border-ink-3 focus:border-info focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-info/25 disabled:opacity-60';

export function Field({ label, hint, children, className = '' }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-2">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-2xs text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} h-9 w-full ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} h-9 pr-8 ${/\bw-/.test(className) ? '' : 'w-full'} ${className}`} {...props}>
      {children}
    </select>
  );
}

// Cresce com o conteúdo, para roteiros longos não ficarem presos numa caixa com scroll
export function Textarea({ className = '', value, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={3} className={`${CONTROL} w-full resize-none py-2 leading-relaxed ${className}`} {...props} />;
}

// Campo sem moldura, para títulos editáveis direto na página
export function BareInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`w-full rounded-md bg-transparent px-1 -mx-1 text-ink placeholder:text-ink-3 hover:bg-hover focus:bg-sunken focus:outline-none ${className}`} {...props} />;
}

export function SegmentedControl<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-line bg-panel p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`h-7 rounded-full px-3 text-xs font-medium transition-colors duration-150 ${option.value === value ? 'bg-ink text-canvas' : 'text-ink-2 hover:text-ink'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
