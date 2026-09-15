import type { LucideIcon } from 'lucide-react';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50',
  secondary: 'border border-line-strong bg-panel text-ink hover:bg-hover disabled:opacity-50',
  ghost: 'text-ink-2 hover:bg-hover hover:text-ink disabled:opacity-40',
  danger: 'text-down hover:bg-down-soft disabled:opacity-40',
};
const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-2.5 text-[13px]',
  md: 'h-9 gap-2 px-3.5 text-sm',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra = ''): string {
  return `inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading = false, className = '', children, disabled, type = 'button', ...props }: ButtonProps) {
  const iconSize = size === 'sm' ? 15 : 17;
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading ? <LoaderCircle size={iconSize} className="animate-spin" aria-hidden /> : Icon ? <Icon size={iconSize} strokeWidth={2} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ variant = 'secondary', size = 'md', icon: Icon, className = '', children, ...props }: LinkProps & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden /> : null}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  size?: Size;
  active?: boolean;
}

export function IconButton({ icon: Icon, label, size = 'md', active = false, className = '', type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40 ${size === 'sm' ? 'size-8' : 'size-9'} ${active ? 'bg-hover text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'} ${className}`}
      {...props}
    >
      <Icon size={size === 'sm' ? 16 : 19} strokeWidth={1.9} aria-hidden />
    </button>
  );
}
