import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Hash, Lightbulb, RefreshCw, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { LineChart } from '@/components/charts';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { Badge, Delta, EmptyState, Panel, ScoreBar } from '@/components/ui/feedback';
import { SegmentedControl, Textarea } from '@/components/ui/form';
import { Avatar, Thumb } from '@/components/ui/media';
import { ConfirmDialog } from '@/components/ui/overlay';
import { dailyGains, findTopics, median, valueAt, type AnalyzedChannel } from '@/lib/analytics';
import { createPauta } from '@/lib/database';
import { dateKey, formatAge, formatCompact, formatDate, formatNumber, formatPercent, formatScore, shiftDate } from '@/lib/format';
import { toSentenceCase } from '@/lib/recommendations';
import { useCollect } from '@/hooks/useCollect';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 } as const;

// "Jul 21, 2011" (texto do YouTube em inglês) → "jul. de 2011"
function formatJoined(value: string | null | undefined): string | null {
  const match = value?.match(/^(\w{3}) (\d{1,2}), (\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[1] as keyof typeof MONTHS];
  return month == null ? null : new Date(Number(match[3]), month, Number(match[2])).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function growth(channel: AnalyzedChannel, days: number): number | null {
  const today = dateKey(Date.now());
  const past = valueAt(channel.subscribersSeries, shiftDate(today, -days));
  const now = valueAt(channel.subscribersSeries, today);
  return past == null || now == null ? null : now - past;
}

function likeRate(channel: AnalyzedChannel): number | null {
  const rates = channel.videos.map((video) => video.likeRate).filter((rate): rate is number => rate != null);
  return rates.length ? median(rates) : null;
}

function Comparison({ channel, profile, name }: { channel: AnalyzedChannel; profile: AnalyzedChannel; name: string }) {
  // "higher" define quem está à frente: ritmo menor (publica mais vezes) é melhor
  const rows: { label: string; theirs: number | null; yours: number | null; format: (value: number) => string; higher: boolean }[] = [
    { label: 'Inscritos', theirs: channel.subscribers, yours: profile.subscribers, format: formatCompact, higher: true },
    { label: 'Mediana de views', theirs: channel.baseline, yours: profile.baseline, format: formatCompact, higher: true },
    { label: 'Dias entre vídeos', theirs: channel.uploadEveryDays, yours: profile.uploadEveryDays, format: (value) => `~${Math.round(value)}`, higher: false },
    { label: 'Taxa de like', theirs: likeRate(channel), yours: likeRate(profile), format: (value) => formatPercent(value), higher: true },
    { label: 'Melhor recente', theirs: channel.top?.score ?? null, yours: profile.top?.score ?? null, format: formatScore, higher: true },
  ];
  return (
    <Panel title="Comparado à Jéssica" description="Números dos últimos 15 vídeos de cada canal" padded={false}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-y border-line text-left text-2xs text-ink-3">
            <th className="py-2 pl-5 font-normal">Métrica</th>
            <th className="py-2 pr-4 text-right font-normal">{name.split(' ')[0]}</th>
            <th className="py-2 pr-5 text-right font-normal">Jéssica</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => {
            const theirsAhead = row.theirs != null && row.yours != null && (row.higher ? row.theirs > row.yours : row.theirs < row.yours);
            const yoursAhead = row.theirs != null && row.yours != null && (row.higher ? row.yours > row.theirs : row.yours < row.theirs);
            return (
              <tr key={row.label}>
                <td className="py-2.5 pl-5 text-ink-2">{row.label}</td>
                <td className={`py-2.5 pr-4 text-right tabular-nums ${theirsAhead ? 'font-medium text-ink' : 'text-ink-2'}`}>{row.theirs == null ? '—' : row.format(row.theirs)}</td>
                <td className={`py-2.5 pr-5 text-right tabular-nums ${yoursAhead ? 'font-medium text-up' : 'text-ink-2'}`}>{row.yours == null ? '—' : row.format(row.yours)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-5 py-3 text-2xs text-ink-3">Em destaque, quem está à frente em cada linha.</p>
    </Panel>
  );
}

export function ChannelDetail() {
  const { handle: rawHandle = '' } = useParams();
  const handle = rawHandle.toLowerCase();
  const navigate = useNavigate();
  const { db, analysis, mutate } = useData();
  const { toast } = useUi();
  const { collect, collecting } = useCollect();
  const { saveReference, ensureVideoReference } = useCreate();
  const [chart, setChart] = useState<'subscribers' | 'views'>('subscribers');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const entry = db.channels.find((channel) => channel.handle.toLowerCase() === handle);
  const isProfile = db.profile.handle.toLowerCase() === handle;
  const data = analysis?.channels.get(handle);
  const name = entry?.name ?? (isProfile ? db.profile.name : data?.title ?? handle);
  const topics = useMemo(() => (data ? findTopics(data.videos, db, { minTotal: 2, minHits: 1, limit: 6 }) : []), [data, db]);
  const savedIds = new Set(db.references.map((reference) => reference.videoId));

  if (!entry && !isProfile) {
    return (
      <Panel>
        <EmptyState icon={Users} title="Canal fora do radar" action={<ButtonLink to="/radar?aba=canais">Ver canais do radar</ButtonLink>}>
          {handle} não está na lista de canais monitorados.
        </EmptyState>
      </Panel>
    );
  }

  const joined = formatJoined(data?.joinedDate);
  const points = chart === 'subscribers' ? (data?.subscribersSeries ?? []) : dailyGains(data?.totalViewsSeries ?? []);
  const stats = data
    ? [
        { label: 'Inscritos', value: formatCompact(data.subscribers), extra: <Delta value={growth(data, 7)} format={formatCompact} suffix="7 dias" /> },
        { label: 'Views totais', value: formatCompact(data.totalViews), extra: <span className="text-2xs text-ink-3">{formatNumber(data.videoCount)} vídeos</span> },
        { label: 'Mediana recente', value: formatCompact(data.baseline), extra: <span className="text-2xs text-ink-3">views por vídeo</span> },
        { label: 'Ritmo', value: data.uploadEveryDays ? `~${Math.round(data.uploadEveryDays)} ${Math.round(data.uploadEveryDays) === 1 ? 'dia' : 'dias'}` : '—', extra: <span className="text-2xs text-ink-3">{data.daysSinceUpload == null ? '' : data.daysSinceUpload < 1 ? 'publicou hoje' : `último há ${Math.floor(data.daysSinceUpload)}d`}</span> },
      ]
    : [];

  const adapt = (videoId: string, title: string, score: number | null) => {
    const referenceId = ensureVideoReference(videoId);
    const pauta = createPauta({ title: toSentenceCase(title), notes: `Adaptado de ${name}${score ? ` (${formatScore(score)} a mediana)` : ''}: https://www.youtube.com/watch?v=${videoId}`, referenceIds: referenceId ? [referenceId] : [] });
    mutate((draft) => void draft.pautas.unshift(pauta));
    navigate(`/pautas/${pauta.id}`);
  };

  return (
    <>
      <Link to="/radar?aba=canais" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Radar
      </Link>

      <header className="mb-6 flex flex-wrap items-start gap-4">
        <Avatar src={data?.avatar} name={name} size={80} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-[-0.01em]">{name}</h1>
            {isProfile ? <Badge tone="accent">Canal gerenciado</Badge> : null}
            {data?.error ? <Badge tone="down">Erro na última coleta</Badge> : null}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-2">
            <a href={`https://www.youtube.com/${entry?.handle ?? db.profile.handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
              {entry?.handle ?? db.profile.handle} <ExternalLink size={12} aria-hidden />
            </a>
            {joined ? ` · no YouTube desde ${joined}` : ''}
            {data?.collectedAt ? ` · coletado ${formatAge(data.collectedAt)}` : ''}
          </p>
          {data?.description ? (
            <button type="button" onClick={() => setExpanded((value) => !value)} className={`mt-2 max-w-3xl text-left text-[13px] leading-relaxed whitespace-pre-line text-ink-2 ${expanded ? '' : 'line-clamp-2'}`}>
              {data.description}
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button icon={RefreshCw} loading={collecting} onClick={() => void collect()}>
            Coletar
          </Button>
          {entry ? <IconButton icon={Trash2} label="Remover do radar" onClick={() => setConfirmRemove(true)} /> : null}
        </div>
      </header>

      {!data ? (
        <Panel>
          <EmptyState icon={RefreshCw} title="Aguardando a primeira coleta" action={<Button icon={RefreshCw} loading={collecting} onClick={() => void collect()}>Coletar agora</Button>}>
            Os números deste canal aparecem depois da próxima coleta (automática às 06h e 18h).
          </EmptyState>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4 xl:col-span-3">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-panel px-5 py-4">
                <dt className="text-xs text-ink-2">{stat.label}</dt>
                <dd className="mt-1 text-2xl font-medium tracking-[-0.01em]">{stat.value}</dd>
                <dd className="mt-0.5">{stat.extra}</dd>
              </div>
            ))}
          </dl>

          <Panel
            className="xl:col-span-2"
            title="Evolução"
            description="Registrada a cada coleta"
            actions={<SegmentedControl label="Gráfico" value={chart} onChange={setChart} options={[{ value: 'subscribers', label: 'Inscritos' }, { value: 'views', label: 'Views por dia' }]} />}
          >
            <LineChart points={points} label={chart === 'subscribers' ? 'Inscritos' : 'Views por dia'} zeroBased={chart === 'views'} height={240} valueFormat={(value) => `${formatNumber(value)} ${chart === 'subscribers' ? 'inscritos' : 'views'}`} emptyMessage="A linha aparece a partir do segundo dia de coleta deste canal." />
          </Panel>

          {!isProfile && analysis?.profile ? <Comparison channel={data} profile={analysis.profile} name={name} /> : <Panel title="Temas do canal">{topics.length ? <p className="text-sm text-ink-2">{topics.map((topic) => topic.label).join(' · ')}</p> : <p className="text-sm text-ink-2">Sem temas recorrentes ainda.</p>}</Panel>}

          <Panel className="xl:col-span-2" title="Últimos vídeos" description={`Mediana do canal: ${formatCompact(data.baseline)} views`} padded={false}>
            <ul className="divide-y divide-line border-t border-line">
              {data.videos.map((video) => (
                <li key={video.id} className="flex items-center gap-3.5 px-5 py-3 hover:bg-hover">
                  <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="shrink-0">
                    <Thumb videoId={video.id} className="w-28 sm:w-36" />
                  </a>
                  <div className="min-w-0 flex-1">
                    <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[13px] text-ink hover:underline sm:text-sm">
                      {video.title}
                    </a>
                    <p className="mt-0.5 text-xs text-ink-3 tabular-nums">
                      {formatDate(video.published)} · {formatCompact(video.views)} views · {formatCompact(video.likes)} likes{video.gained24h != null ? ` · +${formatCompact(video.gained24h)} em 24h` : ''}
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <ScoreBar score={video.score} />
                  </div>
                  {!isProfile ? (
                    <div className="flex shrink-0 items-center">
                      {savedIds.has(video.id) ? (
                        <span className="flex size-8 items-center justify-center text-up" title="Na biblioteca">
                          <BookmarkCheck size={17} aria-label="Na biblioteca" />
                        </span>
                      ) : (
                        <IconButton icon={Bookmark} size="sm" label="Salvar na biblioteca" onClick={() => saveReference(video.id)} />
                      )}
                      <IconButton icon={Lightbulb} size="sm" label="Adaptar em uma pauta" onClick={() => adapt(video.id, video.title, video.score)} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Panel>

          <div className="space-y-4">
            {!isProfile ? (
              <Panel title="Temas deste canal" description="Palavras que se repetem nos títulos acima da mediana">
                {topics.length ? (
                  <ul className="space-y-2">
                    {topics.map((topic) => (
                      <li key={topic.term} className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-1.5 text-ink">
                          <Hash size={13} className="text-ink-3" aria-hidden />
                          {topic.label}
                        </span>
                        <span className="text-xs text-ink-3 tabular-nums">
                          {topic.hits}/{topic.total} · {formatScore(topic.avgScore)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-2">Ainda sem temas repetidos acima da mediana.</p>
                )}
              </Panel>
            ) : null}
            {entry ? (
              <Panel title="Anotações" description="O que observar neste canal">
                <Textarea
                  value={entry.note}
                  onChange={(event) => mutate((draft) => void (draft.channels.find((item) => item.id === entry.id)!.note = event.target.value))}
                  placeholder="Ex.: ganchos com número no título, thumbs com rosto e fundo vermelho, posta às 18h"
                  aria-label="Anotações sobre o canal"
                />
              </Panel>
            ) : null}
          </div>
        </div>
      )}

      {entry ? (
        <ConfirmDialog
          open={confirmRemove}
          onClose={() => setConfirmRemove(false)}
          title="Remover canal do radar?"
          description={`${name} sai da comparação e da coleta.`}
          confirmLabel="Remover"
          onConfirm={() => {
            mutate((draft) => void (draft.channels = draft.channels.filter((item) => item.id !== entry.id)));
            toast('Canal removido do radar.');
            navigate('/radar?aba=canais');
          }}
        />
      ) : null}
    </>
  );
}
