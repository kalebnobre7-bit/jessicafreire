import { ArrowRight, CalendarDays, Heart, RefreshCw, Sparkles, SquareKanban, ThumbsUp, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { LineChart } from '@/components/charts';
import { InsightList } from '@/components/InsightList';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, Delta, EmptyState, PageHeader, Panel, ScoreBadge, ScoreBar, Skeleton } from '@/components/ui/feedback';
import { SegmentedControl } from '@/components/ui/form';
import { Avatar, Thumb } from '@/components/ui/media';
import { buildInsights, dailyGains, valueAt, valueFrom, type AnalyzedChannel, type Point } from '@/lib/analytics';
import { STAGE_LABEL } from '@/lib/constants';
import { buildRecommendations, RECOMMENDATION_LABEL } from '@/lib/recommendations';
import { dateKey, formatAge, formatCompact, formatDate, formatNumber, formatPercent, shiftDate } from '@/lib/format';
import { useCollect } from '@/hooks/useCollect';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';

type Period = '7' | '28' | '90';
type MetricTab = 'views' | 'subscribers' | 'uploads';

function periodStats(profile: AnalyzedChannel, days: number) {
  const today = dateKey(Date.now());
  const from = shiftDate(today, -days);
  const previousFrom = shiftDate(from, -days);
  const totalViews = profile.totalViewsSeries;
  const viewsStart = valueFrom(totalViews, from, today);
  const viewsEnd = valueAt(totalViews, today);
  const views = viewsStart != null && viewsEnd != null && viewsEnd !== viewsStart ? viewsEnd - viewsStart : null;
  const previousStart = valueAt(totalViews, previousFrom);
  const previousViews = previousStart != null && viewsStart != null && valueAt(totalViews, from) != null ? viewsStart - previousStart : null;
  const subsStart = valueFrom(profile.subscribersSeries, from, today);
  const subsEnd = valueAt(profile.subscribersSeries, today) ?? profile.subscribers;
  const uploads = profile.videos.filter((video) => dateKey(Date.parse(video.published)) > from);
  const previousUploads = profile.videos.filter((video) => {
    const key = dateKey(Date.parse(video.published));
    return key > previousFrom && key <= from;
  });
  const oldestFeedVideo = profile.videos.at(-1);
  const feedCoversPrevious = oldestFeedVideo ? dateKey(Date.parse(oldestFeedVideo.published)) <= previousFrom : false;
  return {
    from,
    views,
    viewsDelta: views != null && previousViews ? views - previousViews : null,
    viewsSeries: dailyGains(totalViews.filter((point) => point.date >= from)),
    subscribers: subsEnd,
    subscribersDelta: subsStart != null && subsEnd != null && profile.subscribersSeries.length > 1 ? subsEnd - subsStart : null,
    subscribersSeries: profile.subscribersSeries.filter((point) => point.date >= from),
    uploads,
    uploadsDelta: feedCoversPrevious ? uploads.length - previousUploads.length : null,
    historySince: profile.subscribersSeries[0]?.date ?? null,
  };
}

function AnalyticsPanel({ profile }: { profile: AnalyzedChannel }) {
  const [period, setPeriod] = useState<Period>('28');
  const [tab, setTab] = useState<MetricTab>('views');
  const stats = useMemo(() => periodStats(profile, Number(period)), [profile, period]);

  const tabs: { id: MetricTab; label: string; value: string; delta: number | null; deltaFormat: (value: number) => string }[] = [
    { id: 'views', label: 'Views no período', value: stats.views == null ? '—' : formatCompact(stats.views), delta: stats.viewsDelta, deltaFormat: formatCompact },
    { id: 'subscribers', label: 'Inscritos', value: formatCompact(stats.subscribers), delta: stats.subscribersDelta, deltaFormat: formatCompact },
    { id: 'uploads', label: 'Vídeos publicados', value: String(stats.uploads.length), delta: stats.uploadsDelta, deltaFormat: String },
  ];

  const chart: { points: Point[]; label: string; zeroBased: boolean; format: (value: number) => string } | null =
    tab === 'views' ? { points: stats.viewsSeries, label: 'Views por dia', zeroBased: true, format: (value) => `${formatNumber(value)} views` } : tab === 'subscribers' ? { points: stats.subscribersSeries, label: 'Inscritos', zeroBased: false, format: (value) => `${formatNumber(value)} inscritos` } : null;

  return (
    <Panel
      className="xl:col-span-2"
      padded={false}
      title="Análise do canal"
      description={`Últimos ${period} dias`}
      actions={<SegmentedControl label="Período" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 dias' }, { value: '28', label: '28 dias' }, { value: '90', label: '90 dias' }]} />}
    >
      <div role="tablist" aria-label="Métrica" className="grid grid-cols-3 border-y border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`relative min-w-0 px-3 py-3.5 text-left sm:px-5 sm:py-4 transition-colors duration-150 hover:bg-hover ${tab === item.id ? 'bg-sunken' : ''} [&:not(:first-child)]:border-l [&:not(:first-child)]:border-line`}
          >
            <span className="block truncate text-xs text-ink-2">{item.label}</span>
            <span className="mt-1 block truncate text-xl font-medium tracking-[-0.01em] text-ink sm:text-2xl">{item.value}</span>
            <Delta value={item.delta} format={item.deltaFormat} className="mt-0.5" />
            {tab === item.id ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" aria-hidden /> : null}
          </button>
        ))}
      </div>
      <div className="px-5 pt-4 pb-5">
        {chart ? (
          <>
            <LineChart height={280} points={chart.points} label={chart.label} zeroBased={chart.zeroBased} valueFormat={chart.format} emptyMessage={tab === 'views' ? 'O gráfico de views por dia aparece a partir do segundo dia de coleta.' : 'A linha de inscritos aparece a partir do segundo dia de coleta.'} />
            {stats.historySince ? <p className="mt-2 text-2xs text-ink-3">Histórico coletado desde {formatDate(stats.historySince, { day: 'numeric', month: 'long' })}. Views e inscritos públicos, 2 coletas por dia.</p> : null}
          </>
        ) : stats.uploads.length ? (
          <ul className="divide-y divide-line">
            {stats.uploads.map((video) => (
              <li key={video.id}>
                <Link to={`/videos/${video.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-hover">
                  <Thumb videoId={video.id} className="w-24" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm text-ink">{video.title}</p>
                    <p className="text-xs text-ink-3">{formatDate(video.published)} · {formatCompact(video.views)} views</p>
                  </div>
                  <ScoreBadge score={video.score} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarDays} title="Nenhum vídeo publicado no período" />
        )}
      </div>
    </Panel>
  );
}

function LatestVideo({ profile }: { profile: AnalyzedChannel }) {
  const video = profile.videos[0];
  if (!video) return <Panel title="Último vídeo"><EmptyState icon={TrendingUp} title="Nenhum vídeo no feed do canal" /></Panel>;
  const rows = [
    { label: 'Views', value: formatNumber(video.views), extra: <ScoreBadge score={video.score} /> },
    { label: 'Ganho desde ontem', value: video.gained24h == null ? '—' : `+${formatNumber(video.gained24h)}` },
    { label: 'Likes', value: formatNumber(video.likes), icon: ThumbsUp },
    { label: 'Taxa de like', value: video.likeRate == null ? '—' : formatPercent(video.likeRate), icon: Heart },
  ];
  return (
    <Panel title="Desempenho do último vídeo" description={`Publicado ${formatAge(video.published)}`}>
      <Link to={`/videos/${video.id}`} className="group block">
        <Thumb videoId={video.id} quality="hqdefault" alt="" />
        <p className="mt-3 line-clamp-2 text-sm font-medium text-ink group-hover:underline">{video.title}</p>
      </Link>
      <dl className="mt-3 divide-y divide-line border-t border-line">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2">
            <dt className="text-[13px] text-ink-2">{row.label}</dt>
            <dd className="flex items-center gap-2 text-sm font-medium tabular-nums text-ink">
              {row.extra}
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-2xs text-ink-3">{video.score == null ? 'Vídeos com menos de 3 dias ainda não entram na comparação com a mediana.' : `Mediana do canal: ${formatCompact(profile.baseline)} views por vídeo.`}</p>
      <ButtonLink to={`/videos/${video.id}`} variant="ghost" size="sm" className="mt-3 -ml-2.5">
        Ver análise do vídeo <ArrowRight size={15} aria-hidden />
      </ButtonLink>
    </Panel>
  );
}

function UpcomingPautas() {
  const { db } = useData();
  const { createPauta } = useCreate();
  const upcoming = db.pautas
    .filter((pauta) => ['roteiro', 'gravacao', 'edicao', 'agendado'].includes(pauta.stage))
    .sort((a, b) => (a.publishAt ?? '9999').localeCompare(b.publishAt ?? '9999') || b.updatedAt - a.updatedAt)
    .slice(0, 5);
  const today = dateKey(Date.now());
  return (
    <Panel title="Próximas publicações" description="Pautas em produção" actions={<ButtonLink to="/pautas" variant="ghost" size="sm">Ver quadro</ButtonLink>}>
      {upcoming.length ? (
        <ul className="divide-y divide-line">
          {upcoming.map((pauta) => (
            <li key={pauta.id}>
              <Link to={`/pautas/${pauta.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">{pauta.title || 'Sem título'}</p>
                  <p className={`mt-0.5 text-xs ${pauta.publishAt && pauta.publishAt < today ? 'text-down' : 'text-ink-3'}`}>
                    {pauta.publishAt ? `${pauta.publishAt < today ? 'Atrasada, era' : 'Sai'} ${formatDate(pauta.publishAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Sem data de publicação'}
                  </p>
                </div>
                <Badge tone={pauta.stage === 'agendado' ? 'up' : 'neutral'}>{STAGE_LABEL[pauta.stage]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={SquareKanban} title="Nada em produção" action={<Button size="sm" onClick={() => createPauta()}>Nova pauta</Button>}>
          Pautas em roteiro, gravação, edição ou agendadas aparecem aqui.
        </EmptyState>
      )}
    </Panel>
  );
}

function TopVideos({ profile }: { profile: AnalyzedChannel }) {
  const ranked = [...profile.videos].sort((a, b) => b.views - a.views).slice(0, 5);
  return (
    <Panel className="xl:col-span-2" title="Vídeos mais vistos" description="Entre os últimos 15 do canal" actions={<ButtonLink to="/videos" variant="ghost" size="sm">Ver todos</ButtonLink>} padded={false}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs text-ink-3">
            <th className="w-10 py-2 pl-5 font-normal">#</th>
            <th className="py-2 font-normal">Vídeo</th>
            <th className="hidden py-2 pr-4 text-right font-normal sm:table-cell">Views</th>
            <th className="py-2 pr-5 font-normal">vs. mediana</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ranked.map((video, index) => (
            <tr key={video.id} className="hover:bg-hover">
              <td className="py-2.5 pl-5 tabular-nums text-ink-3">{index + 1}</td>
              <td className="py-2.5 pr-4">
                <Link to={`/videos/${video.id}`} className="flex items-center gap-3">
                  <Thumb videoId={video.id} className="hidden w-20 sm:block" />
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-ink">{video.title}</span>
                    <span className="text-xs text-ink-3">{formatDate(video.published)}<span className="sm:hidden"> · {formatCompact(video.views)} views</span></span>
                  </span>
                </Link>
              </td>
              <td className="hidden py-2.5 pr-4 text-right tabular-nums sm:table-cell">{formatCompact(video.views)}</td>
              <td className="py-2.5 pr-5">
                <ScoreBar score={video.score} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function RadarHighlights() {
  const { analysis } = useData();
  const trending = (analysis?.trending ?? []).slice(0, 4);
  return (
    <Panel title="Em alta no radar" description="Acima da mediana do próprio canal" actions={<ButtonLink to="/radar" variant="ghost" size="sm">Abrir radar</ButtonLink>}>
      {trending.length ? (
        <ul className="space-y-3">
          {trending.map((video) => (
            <li key={video.id}>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="group flex gap-3">
                <Thumb videoId={video.id} className="w-28" badge={video.score ? `${video.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x` : undefined} />
                <div className="min-w-0">
                  <p className="line-clamp-2 text-[13px] text-ink group-hover:underline">{video.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                    <Avatar src={analysis?.channels.get(video.channelHandle)?.avatar} name={video.channelTitle} size={16} />
                    {video.channelTitle} · {formatCompact(video.views)}
                  </p>
                </div>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={TrendingUp} title="Sem canais no radar">Adicione concorrentes para ver o que está performando.</EmptyState>
      )}
    </Panel>
  );
}

function WhatToRecord() {
  const { db, analysis } = useData();
  const recommendations = useMemo(() => buildRecommendations(analysis, db).slice(0, 3), [analysis, db]);
  if (!recommendations.length) return null;
  return (
    <Panel className="xl:col-span-3" title="O que gravar agora" description="As sugestões mais fortes dos dados" actions={<ButtonLink to="/o-que-gravar" variant="ghost" size="sm" icon={Sparkles}>Ver todas e gerar com IA</ButtonLink>}>
      <ul className="grid gap-3 md:grid-cols-3">
        {recommendations.map((recommendation) => (
          <li key={recommendation.id}>
            <Link to="/o-que-gravar" className="flex h-full gap-3 rounded-lg border border-line p-3 transition-colors duration-150 hover:border-line-strong hover:bg-hover">
              {recommendation.videoIds[0] ? <Thumb videoId={recommendation.videoIds[0]} className="w-24" /> : null}
              <div className="min-w-0">
                <p className="text-2xs font-medium text-accent-ink">{RECOMMENDATION_LABEL[recommendation.kind]}</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium text-ink">{recommendation.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-ink-2">{recommendation.reason}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <Skeleton className="h-96 xl:col-span-2" />
      <Skeleton className="h-96" />
      <Skeleton className="h-64 xl:col-span-2" />
      <Skeleton className="h-64" />
    </div>
  );
}

export function Overview() {
  const { db, analysis, ready } = useData();
  const { collect, collecting } = useCollect();
  const profile = analysis?.profile;
  const insights = useMemo(() => (analysis ? buildInsights(analysis, db) : []), [analysis, db]);

  return (
    <>
      <PageHeader
        title="Visão geral do canal"
        description={analysis ? `Métricas coletadas ${formatAge(analysis.updatedAt)} · coletas automáticas às 06h e 18h` : 'Sem métricas coletadas ainda'}
        actions={
          <Button icon={RefreshCw} loading={collecting} onClick={() => void collect()}>
            {collecting ? 'Coletando…' : 'Atualizar métricas'}
          </Button>
        }
      />
      {!ready ? (
        <OverviewSkeleton />
      ) : !profile ? (
        <Panel>
          <EmptyState icon={TrendingUp} title="Nenhuma métrica do canal ainda" action={<Button variant="primary" icon={RefreshCw} loading={collecting} onClick={() => void collect()}>Coletar agora</Button>}>
            A primeira coleta busca inscritos, views e os últimos 15 vídeos de {db.profile.handle} e dos canais do radar.
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <AnalyticsPanel profile={profile} />
          <LatestVideo profile={profile} />
          <Panel className="xl:col-span-2" title="Leituras automáticas" description="O que mudou e o que fazer com isso">
            {insights.length ? <InsightList insights={insights} /> : <EmptyState icon={TrendingUp} title="Nada fora do normal">As leituras aparecem quando um vídeo foge da mediana, uma pauta atrasa ou um tema cresce no radar.</EmptyState>}
          </Panel>
          <UpcomingPautas />
          <WhatToRecord />
          <TopVideos profile={profile} />
          <RadarHighlights />
        </div>
      )}
    </>
  );
}
