const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('pt-BR');
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export function formatCompact(value: number | null | undefined): string {
  return value == null ? '—' : compact.format(value);
}
export function formatNumber(value: number | null | undefined): string {
  return value == null ? '—' : full.format(value);
}
export function formatSigned(value: number, formatter: (value: number) => string = formatCompact): string {
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatter(Math.abs(value))}`;
}
export function formatScore(score: number): string {
  return `${score.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: score < 10 ? 1 : 0 })}x`;
}
export function formatPercent(value: number, digits = 1): string {
  return `${(value * 100).toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: digits })}%`;
}

export function formatAge(input: string | number, now = Date.now()): string {
  const time = typeof input === 'number' ? input : Date.parse(input);
  const minutes = (now - time) / 60_000;
  if (minutes < 1) return 'agora';
  if (minutes < 60) return relative.format(-Math.round(minutes), 'minute');
  const hours = minutes / 60;
  if (hours < 24) return relative.format(-Math.round(hours), 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return relative.format(-days, 'day');
  return relative.format(-Math.round(days / 30), 'month');
}

export function formatDate(input: string | number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  const date = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(`${input}T12:00:00`) : new Date(input);
  return date.toLocaleDateString('pt-BR', options).replace('.', '');
}

export function formatPeriod(from: string, to: string): string {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  return `${formatDate(from, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} a ${formatDate(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

// Datas do histórico são gravadas no fuso de Brasília (YYYY-MM-DD)
export function dateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}
export function shiftDate(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?';
}
