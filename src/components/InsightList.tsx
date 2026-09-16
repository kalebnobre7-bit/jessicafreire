import { Flame, Info, Lightbulb, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Insight } from '@/lib/analytics';
import { useInsightAction } from '@/hooks/useInsightAction';

const TONES: Record<Insight['tone'], { icon: LucideIcon; className: string }> = {
  up: { icon: TrendingUp, className: 'bg-up-soft text-up' },
  down: { icon: TrendingDown, className: 'bg-down-soft text-down' },
  info: { icon: Info, className: 'bg-info-soft text-info' },
  accent: { icon: Flame, className: 'bg-accent-soft text-accent-ink' },
  neutral: { icon: Lightbulb, className: 'bg-sunken text-ink-2' },
};

export function InsightList({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const runAction = useInsightAction();
  const visible = limit ? insights.slice(0, limit) : insights;
  return (
    <ul className="divide-y divide-line">
      {visible.map((insight) => {
        const tone = TONES[insight.tone];
        return (
          <li key={insight.id} className="flex gap-3.5 py-3.5 first:pt-1 last:pb-0">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${tone.className}`}>
              <tone.icon size={16} strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{insight.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{insight.text}</p>
              {insight.actions.length ? (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                  {insight.actions.map((action) => (
                    <button key={action.type} type="button" onClick={() => runAction(action)} className="text-[13px] font-medium text-info hover:underline">
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
