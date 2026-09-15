import { ArrowDown, ArrowUp, MonitorPlay, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel, ScoreBar, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { Thumb } from '@/components/ui/media';
import { matchesQuery, type AnalyzedVideo } from '@/lib/analytics';
import { formatAge, formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { useCollect } from '@/hooks/useCollect';
import { useData } from '@/store/data';

type SortKey = 'published' | 'views' | 'likes' | 'likeRate' | 'score' | 'gained24h';

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: 'published', label: 'Data', className: 'hidden md:table-cell' },
  { key: 'views', label: 'Views', className: 'text-right' },
  { key: 'gained24h', label: '24h', className: 'hidden text-right lg:table-cell' },
  { key: 'likes', label: 'Likes', className: 'hidden text-right lg:table-cell' },
  { key: 'likeRate', label: 'Taxa de like', className: 'hidden text-right xl:table-cell' },
  { key: 'score', label: 'vs. mediana', className: 'hidden sm:table-cell' },
];

function sortValue(video: AnalyzedVideo, key: SortKey): number {
  if (key === 'published') return Date.parse(video.published);
  return video[key] ?? -1;
}

export function Videos() {
  const { db, analysis, ready } = useData();
  const { collect, collecting } = useCollect();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'published', direction: 'desc' });
  const profile = analysis?.profile;

  const linkedPautas = useMemo(() => new Map(db.pautas.filter((pauta) => pauta.videoId).map((pauta) => [pauta.videoId, pauta])), [db.pautas]);
  const videos = useMemo(() => {
    const list = (profile?.videos ?? []).filter((video) => !query.trim() || matchesQuery(video.title, query));
    const factor = sort.direction === 'desc' ? -1 : 1;
    return [...list].sort((a, b) => (sortValue(a, sort.key) - sortValue(b, sort.key)) * factor);
  }, [profile, query, sort]);

  const toggleSort = (key: SortKey) => setSort((current) => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));

  return (
    <>
      <PageHeader
        title="Vídeos do canal"
        description={profile ? `Últimos ${profile.videos.length} vídeos de ${db.profile.handle} · ${formatNumber(profile.videoCount)} no total · mediana de ${formatCompact(profile.baseline)} views` : 'Coleta pública dos últimos 15 vídeos'}
        actions={
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar por título" className="pl-9" aria-label="Filtrar vídeos por título" />
          </div>
        }
      />
      {!ready ? (
        <Skeleton className="h-[480px]" />
      ) : !profile ? (
        <Panel>
          <EmptyState icon={MonitorPlay} title="Nenhum vídeo coletado" action={<Button icon={RefreshCw} loading={collecting} onClick={() => void collect()}>Coletar agora</Button>} />
        </Panel>
      ) : (
        <Panel padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-2">
                  <th className="py-3 pl-5 font-medium">Vídeo</th>
                  {COLUMNS.map((column) => {
                    const active = sort.key === column.key;
                    const Arrow = sort.direction === 'desc' ? ArrowDown : ArrowUp;
                    return (
                      <th key={column.key} className={`py-3 pr-5 font-medium ${column.className}`} aria-sort={active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}>
                        <button type="button" onClick={() => toggleSort(column.key)} className={`inline-flex items-center gap-1 hover:text-ink ${active ? 'text-ink' : ''}`}>
                          {column.label}
                          {active ? <Arrow size={13} aria-hidden /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {videos.map((video) => {
                  const pauta = linkedPautas.get(video.id);
                  return (
                    <tr key={video.id} onClick={() => navigate(`/videos/${video.id}`)} className="cursor-pointer hover:bg-hover">
                      <td className="py-3 pr-4 pl-5">
                        <div className="flex items-center gap-3.5">
                          <Thumb videoId={video.id} className="w-24 sm:w-32" />
                          <div className="min-w-0">
                            <Link to={`/videos/${video.id}`} onClick={(event) => event.stopPropagation()} className="line-clamp-3 max-w-md text-[13px] text-ink hover:underline sm:line-clamp-2 sm:text-sm">
                              {video.title}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                              <span className="md:hidden">{formatAge(video.published)}</span>
                              {pauta ? <Badge tone="info">Pauta ligada</Badge> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden py-3 pr-5 whitespace-nowrap text-ink-2 md:table-cell">
                        {formatDate(video.published, { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="block text-2xs text-ink-3">{formatAge(video.published)}</span>
                      </td>
                      <td className="py-3 pr-5 text-right font-medium tabular-nums">{formatCompact(video.views)}</td>
                      <td className="hidden py-3 pr-5 text-right tabular-nums text-ink-2 lg:table-cell">{video.gained24h == null ? '—' : `+${formatCompact(video.gained24h)}`}</td>
                      <td className="hidden py-3 pr-5 text-right tabular-nums text-ink-2 lg:table-cell">{formatCompact(video.likes)}</td>
                      <td className="hidden py-3 pr-5 text-right tabular-nums text-ink-2 xl:table-cell">{video.likeRate == null ? '—' : formatPercent(video.likeRate)}</td>
                      <td className="hidden py-3 pr-5 sm:table-cell">
                        <ScoreBar score={video.score} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!videos.length ? <EmptyState icon={Search} title={`Nenhum vídeo com "${query}"`} /> : null}
          </div>
          <p className="border-t border-line px-5 py-3 text-2xs text-ink-3">
            "vs. mediana" compara as views com a mediana do canal ({formatCompact(profile.baseline)}). A marca vertical é a mediana; vídeos com menos de 3 dias ficam de fora. "24h" precisa de pelo menos um dia de coleta.
          </p>
        </Panel>
      )}
    </>
  );
}
