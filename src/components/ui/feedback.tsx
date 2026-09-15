import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatScore } from '@/lib/format';

type Tone = 'neutral' | 'accent' | 'up' | 'down' | 'info' | 'warn';

const BADGE_TONES: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-2',
  accent: 'bg-accent-soft text-accent-ink',
  up: 'bg-up-soft text-up',
  down: 'bg-down-soft text-down',
  info: 'bg-info-soft text-info',
  warn: 'bg-warn-soft text-warn',
};

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }: { tone?: Tone; icon?: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap ${BADGE_TONES[tone]} ${className}`}>
      {Icon ? <Icon size={12} strokeWidth={2.2} aria-hidden /> : null}
      {children}
    </span>
  );
}

// Variação com sinal e seta: nunca depende só da cor
export function Delta({ value, format, suffix = '', className = '' }: { value: number | null; format: (value: number) => string; suffix?: string; className?: string }) {
  if (value == null) return <span className={`text-2xs text-ink-3 ${className}`}>sem histórico</span>;
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus;
  const tone = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-3';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${tone} ${className}`}>
      <Icon size={14} strokeWidth={2.2} aria-hidden />
      {value > 0 ? '+' : value < 0 ? '−' : ''}
      {format(Math.abs(value))}
      {suffix ? <span className="font-normal text-ink-3">&nbsp;{suffix}</span> : null}
    </span>
  );
}

// Desempenho contra a mediana do canal: 1x = na média
export function ScoreBadge({ score, className = '' }: { score: number | null; className?: string }) {
  if (score == null) return <Badge className={className}>Novo</Badge>;
  const tone: Tone = score >= 1.5 ? 'up' : score >= 0.8 ? 'neutral' : 'down';
  const Icon = score >= 1.5 ? ArrowUpRight : score < 0.8 ? ArrowDownRight : undefined;
  return (
    <Badge tone={tone} icon={Icon} className={`tabular-nums ${className}`}>
      {formatScore(score)}
    </Badge>
  );
}

export function ScoreBar({ score, max = 3 }: { score: number | null; max?: number }) {
  if (score == null) return <span className="text-2xs text-ink-3">novo</span>;
  const width = Math.min(1, score / max) * 100;
  const median = (1 / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 rounded-full bg-sunken" aria-hidden>
        <div className={`h-full rounded-full ${score >= 1 ? 'bg-up' : 'bg-down'}`} style={{ width: `${width}%` }} />
        <div className="absolute -top-0.5 h-2.5 w-px bg-ink-3" style={{ left: `${median}%` }} title="Mediana do canal" />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-ink-2">{formatScore(score)}</span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton rounded-md ${className}`} aria-hidden />;
}

export function EmptyState({ icon: Icon, title, children, action, className = '' }: { icon: LucideIcon; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-10 text-center ${className}`}>
      <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-sunken text-ink-3">
        <Icon size={22} strokeWidth={1.8} aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-[13px] text-ink-2">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Panel({ title, description, actions, children, className = '', padded = true }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title ? <h2 className="text-[15px] font-medium text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-ink-2">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? 'px-5 pb-5' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-medium tracking-[-0.01em] text-ink">{title}</h1>
          {description ? <p className="mt-1 text-[13px] text-ink-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
