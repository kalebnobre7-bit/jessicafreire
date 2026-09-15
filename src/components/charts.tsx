// Gráficos em SVG próprio: uma série, linha de 2px com lavagem de 10%, grade discreta e crosshair com tooltip.
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { Point } from '@/lib/analytics';
import { formatCompact, formatDate, formatNumber } from '@/lib/format';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

// Ticks "redondos" (0, 2 mil, 4 mil...) para o eixo Y
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= rawStep) ?? 10) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.5; value += step) ticks.push(Number(value.toFixed(6)));
  return ticks;
}

const padding = { top: 12, right: 12, bottom: 26, left: 48 };

interface LineChartProps {
  points: Point[];
  label: string;
  height?: number;
  valueFormat?: (value: number) => string;
  zeroBased?: boolean;
  emptyMessage: string;
}

export function LineChart({ points, label, height = 220, valueFormat = formatNumber, zeroBased = false, emptyMessage }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const gradientId = useId();

  const geometry = useMemo(() => {
    if (points.length < 2 || width === 0) return null;
    const values = points.map((point) => point.value);
    const rawMin = zeroBased ? 0 : Math.min(...values);
    const rawMax = Math.max(...values);
    const spread = rawMax - rawMin || Math.max(1, rawMax * 0.02);
    const ticks = niceTicks(zeroBased ? 0 : rawMin - spread * 0.1, rawMax + spread * 0.1);
    const min = ticks[0] ?? rawMin;
    const max = ticks.at(-1) ?? rawMax;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const x = (index: number) => padding.left + (index / (points.length - 1)) * innerWidth;
    const y = (value: number) => padding.top + (1 - (value - min) / (max - min || 1)) * innerHeight;
    const line = points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join('');
    const area = `${line}L${x(points.length - 1).toFixed(1)},${padding.top + innerHeight}L${padding.left},${padding.top + innerHeight}Z`;
    const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerWidth / 72))));
    return { ticks, x, y, line, area, innerWidth, innerHeight, labelEvery };
  }, [points, width, height, zeroBased]);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relative = (event.clientX - bounds.left - padding.left) / geometry.innerWidth;
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(relative * (points.length - 1)))));
  };

  const hovered = hover == null ? null : points[hover];
  const last = points.at(-1);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {points.length < 2 ? (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-line text-center">
          <p className="text-sm text-ink-2">{emptyMessage}</p>
          {last ? <p className="mt-1 text-xs text-ink-3">Primeiro registro: {valueFormat(last.value)} em {formatDate(last.date)}</p> : null}
        </div>
      ) : geometry ? (
        <>
          <svg width={width} height={height} role="img" aria-label={`${label}: ${points.length} dias, de ${valueFormat(points[0]?.value ?? 0)} a ${valueFormat(last?.value ?? 0)}`} onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} className="touch-none select-none">
            <defs>
              <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.14" />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {geometry.ticks.map((tick) => (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={geometry.y(tick)} y2={geometry.y(tick)} stroke="var(--line)" strokeWidth={1} />
                <text x={padding.left - 8} y={geometry.y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-2xs tabular-nums">
                  {formatCompact(tick)}
                </text>
              </g>
            ))}
            {points.map((point, index) =>
              (index % geometry.labelEvery === 0 && points.length - 1 - index >= geometry.labelEvery * 0.7) || index === points.length - 1 ? (
                <text key={point.date} x={geometry.x(index)} y={height - 6} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="fill-ink-3 text-2xs">
                  {formatDate(point.date)}
                </text>
              ) : null,
            )}
            <path d={geometry.area} fill={`url(#${gradientId})`} />
            <path d={geometry.line} fill="none" stroke="var(--chart-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hovered && hover != null ? (
              <g>
                <line x1={geometry.x(hover)} x2={geometry.x(hover)} y1={padding.top} y2={padding.top + geometry.innerHeight} stroke="var(--line-strong)" strokeWidth={1} />
                <circle cx={geometry.x(hover)} cy={geometry.y(hovered.value)} r={4.5} fill="var(--chart-2)" stroke="var(--panel)" strokeWidth={2} />
              </g>
            ) : last ? (
              <circle cx={geometry.x(points.length - 1)} cy={geometry.y(last.value)} r={4} fill="var(--chart-2)" stroke="var(--panel)" strokeWidth={2} />
            ) : null}
          </svg>
          {hovered && hover != null ? (
            <div
              className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-panel px-2.5 py-1.5 shadow-pop"
              style={{ left: Math.min(Math.max(geometry.x(hover) - 60, 0), width - 130) }}
            >
              <p className="text-sm font-medium tabular-nums text-ink">{valueFormat(hovered.value)}</p>
              <p className="text-2xs text-ink-2">{formatDate(hovered.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function Sparkline({ points, width = 96, height = 28 }: { points: Point[]; width?: number; height?: number }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${((index / (points.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((point.value - min) / (max - min || 1)) * (height - 4)).toFixed(1)}`).join('');
  return (
    <svg width={width} height={height} aria-hidden>
      <path d={path} fill="none" stroke="var(--chart-2)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
