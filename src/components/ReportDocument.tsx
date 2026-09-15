// O relatório como a Jéssica vê: linguagem simples, números com contexto e recomendações numeradas
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Avatar, Thumb } from '@/components/ui/media';
import { formatCompact, formatDate, formatNumber, formatPeriod, formatScore } from '@/lib/format';
import type { Report, ReportSnapshot } from '@/lib/types';

function delta(start: number | null, end: number | null): number | null {
  return start == null || end == null || start === end ? null : end - start;
}

function Figure({ label, value, note, trend }: { label: string; value: string; note: string; trend?: number | null }) {
  const Icon = trend == null || trend === 0 ? null : trend > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="px-4 py-4 first:pl-0 sm:px-5">
      <p className="text-xs text-ink-2">{label}</p>
      <p className={`mt-1 flex items-center gap-1 text-[26px] leading-tight font-medium tracking-[-0.01em] ${trend != null && trend < 0 ? 'text-down' : 'text-ink'}`}>
        {Icon ? <Icon size={20} strokeWidth={2.2} className={trend && trend > 0 ? 'text-up' : 'text-down'} aria-hidden /> : null}
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-ink-3">{note}</p>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  return <div className="text-[15px] leading-relaxed whitespace-pre-line text-ink">{text}</div>;
}

export function ReportDocument({ report, snapshot, profile }: { report: Report; snapshot: ReportSnapshot | null; profile: { name: string; handle: string; avatar: string | null } }) {
  const subscribers = snapshot ? delta(snapshot.subscribers.start, snapshot.subscribers.end) : null;
  const views = snapshot ? delta(snapshot.views.start, snapshot.views.end) : null;
  const best = snapshot?.videos.filter((video) => video.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const recommendations = report.recommendations.map((item) => item.trim()).filter(Boolean);

  return (
    <article className="text-ink">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-6">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">Relatório do canal</p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-medium tracking-[-0.015em]">{report.title || 'Relatório'}</h1>
          <p className="mt-1 text-sm text-ink-2">{formatPeriod(report.from, report.to)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium">{profile.name}</p>
            <p className="text-xs text-ink-3">{profile.handle}</p>
          </div>
          <Avatar src={profile.avatar} name={profile.name} size={44} />
        </div>
      </header>

      <section aria-label="Números do período" className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
        <Figure label="Novos inscritos" value={subscribers == null ? '—' : `${subscribers > 0 ? '+' : ''}${formatCompact(subscribers)}`} note={subscribers == null ? 'histórico ainda curto' : `${formatCompact(snapshot?.subscribers.end)} no total`} trend={subscribers} />
        <Figure label="Views no período" value={views == null ? '—' : formatCompact(views)} note={views == null ? 'histórico ainda curto' : 'somando todos os vídeos'} />
        <Figure label="Vídeos publicados" value={String(snapshot?.videos.length ?? 0)} note="no período" />
        <Figure label="Melhor vídeo" value={best?.score != null ? formatScore(best.score) : '—'} note={best ? 'comparado ao normal do canal' : 'sem vídeo com 3+ dias'} />
      </section>

      {report.summary.trim() ? (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-medium">Resumo</h2>
          <Prose text={report.summary} />
        </section>
      ) : null}

      {snapshot?.videos.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-medium">Vídeos do período</h2>
          <ul className="divide-y divide-line border-y border-line">
            {snapshot.videos.map((video) => (
              <li key={video.id} className="flex items-center gap-4 py-3">
                <Thumb videoId={video.id} className="w-28 sm:w-36" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{video.title}</p>
                  <p className="mt-0.5 text-xs text-ink-3">Publicado em {formatDate(video.published, { day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-medium tabular-nums">{formatNumber(video.views)}</p>
                  <p className={`text-2xs ${video.score == null ? 'text-ink-3' : video.score >= 1 ? 'text-up' : 'text-down'}`}>{video.score == null ? 'ainda recente' : `${formatScore(video.score)} o normal`}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-2xs text-ink-3">"O normal" é a mediana de views dos últimos vídeos do canal ({formatCompact(snapshot.baseline)}).</p>
        </section>
      ) : null}

      {report.wins.trim() ? (
        <section className="mt-8">
          <h2 className="mb-2 text-base font-medium">O que funcionou</h2>
          <Prose text={report.wins} />
        </section>
      ) : null}

      {recommendations.length ? (
        <section className="mt-8">
          <h2 className="mb-3 text-base font-medium">Próximos passos</h2>
          <ol className="space-y-3">
            {recommendations.map((item, index) => (
              <li key={`${index}-${item.slice(0, 12)}`} className="flex gap-3.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-on-accent tabular-nums">{index + 1}</span>
                <p className="pt-0.5 text-[15px] leading-relaxed">{item}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {snapshot?.competitors.length ? (
        <section className="mt-8">
          <h2 className="mb-1 text-base font-medium">De olho nos concorrentes</h2>
          <p className="mb-3 text-xs text-ink-2">Vídeos de outros canais que foram bem acima do normal deles.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {snapshot.competitors.map((video) => (
              <a key={video.id} href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="group block">
                <Thumb videoId={video.id} badge={formatScore(video.score)} />
                <p className="mt-2 line-clamp-2 text-xs font-medium group-hover:underline">{video.title}</p>
                <p className="text-2xs text-ink-3">
                  {video.channel} · {formatCompact(video.views)} views
                </p>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="mt-10 border-t border-line pt-4 text-2xs text-ink-3">
        Preparado por Nobre Designs · dados públicos do YouTube{snapshot ? ` coletados em ${formatDate(snapshot.collectedAt, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
      </footer>
    </article>
  );
}
