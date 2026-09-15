import { Bookmark, BookmarkCheck, ExternalLink, Flame, Hash, Link2, Lightbulb, MoreHorizontal, Plus, RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel, ScoreBadge } from '@/components/ui/feedback';
import { Field, Input, Select } from '@/components/ui/form';
import { Avatar, Thumb } from '@/components/ui/media';
import { ConfirmDialog, Menu } from '@/components/ui/overlay';
import type { AnalyzedChannel } from '@/lib/analytics';
import { createId, normalizeHandle, parseVideoId } from '@/lib/database';
import { formatAge, formatCompact, formatScore } from '@/lib/format';
import { useCollect } from '@/hooks/useCollect';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

type Tab = 'alta' | 'canais' | 'temas' | 'salvos';
const TABS: { id: Tab; label: string }[] = [
  { id: 'alta', label: 'Em alta' },
  { id: 'canais', label: 'Canais' },
  { id: 'temas', label: 'Temas' },
  { id: 'salvos', label: 'Salvos' },
];

function Trending() {
  const { db, analysis } = useData();
  const { saveReference } = useCreate();
  const [channel, setChannel] = useState('todos');
  const [sort, setSort] = useState<'score' | 'views' | 'recent'>('score');
  const saved = new Set(db.references.map((reference) => reference.videoId));
  const videos = useMemo(() => {
    const list = (analysis?.radar ?? []).flatMap((item) => item.videos).filter((video) => channel === 'todos' || video.channelHandle === channel);
    const sorters = { score: (a: typeof list[number], b: typeof list[number]) => (b.score ?? -1) - (a.score ?? -1), views: (a: typeof list[number], b: typeof list[number]) => b.views - a.views, recent: (a: typeof list[number], b: typeof list[number]) => Date.parse(b.published) - Date.parse(a.published) };
    return [...list].sort(sorters[sort]);
  }, [analysis, channel, sort]);

  if (!analysis?.radar.length) return <Panel><EmptyState icon={Flame} title="Nenhum canal no radar com métricas">Adicione canais na aba Canais e rode uma coleta.</EmptyState></Panel>;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por canal">
          {[{ handle: 'todos', title: 'Todos os canais', avatar: null as string | null }, ...analysis.radar].map((item) => (
            <button
              key={item.handle}
              type="button"
              onClick={() => setChannel(item.handle)}
              aria-pressed={channel === item.handle}
              className={`inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] transition-colors duration-150 ${channel === item.handle ? 'bg-ink text-canvas' : 'bg-sunken text-ink hover:bg-hover'}`}
            >
              {item.handle !== 'todos' ? <Avatar src={item.avatar} name={item.title} size={18} /> : null}
              {item.title}
            </button>
          ))}
        </div>
        <Select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className="ml-auto h-8 w-auto text-[13px]" aria-label="Ordenar">
          <option value="score">Mais acima da mediana</option>
          <option value="views">Mais views</option>
          <option value="recent">Mais recentes</option>
        </Select>
      </div>
      <div className="grid gap-x-4 gap-y-7 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {videos.map((video) => (
          <article key={video.id} className="group min-w-0">
            <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="block">
              <Thumb videoId={video.id} quality="hqdefault" alt="" className="rounded-xl" badge={video.score != null ? formatScore(video.score) : 'NOVO'} />
            </a>
            <div className="mt-3 flex gap-3">
              <Avatar src={analysis.channels.get(video.channelHandle)?.avatar} name={video.channelTitle} size={36} />
              <div className="min-w-0 flex-1">
                <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm leading-snug font-medium text-ink hover:underline">
                  {video.title}
                </a>
                <p className="mt-1 text-xs text-ink-2">{video.channelTitle}</p>
                <p className="text-xs text-ink-3">
                  {formatCompact(video.views)} visualizações · {formatAge(video.published)}
                </p>
              </div>
              {saved.has(video.id) ? (
                <span className="flex size-8 shrink-0 items-center justify-center text-up" title="Salvo nas referências">
                  <BookmarkCheck size={18} aria-label="Salvo" />
                </span>
              ) : (
                <IconButton icon={Bookmark} size="sm" label="Salvar como referência" onClick={() => saveReference(video.id)} />
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function ChannelRow({ label, channel, you }: { label: string; channel: AnalyzedChannel | undefined; you?: boolean }) {
  return (
    <>
      <td className="py-3 pr-4 pl-5">
        <div className="flex items-center gap-3">
          <Avatar src={channel?.avatar} name={label} size={36} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-medium text-ink">
              {label}
              {you ? <Badge tone="accent">Canal gerenciado</Badge> : null}
            </p>
            <p className="text-xs text-ink-3">{channel?.handle}</p>
          </div>
        </div>
      </td>
      {channel ? (
        <>
          <td className="py-3 pr-4 text-right tabular-nums">{formatCompact(channel.subscribers)}</td>
          <td className="hidden py-3 pr-4 text-right tabular-nums md:table-cell">{formatCompact(channel.baseline)}</td>
          <td className="hidden py-3 pr-4 whitespace-nowrap text-ink-2 md:table-cell">{channel.uploadEveryDays ? `a cada ~${Math.round(channel.uploadEveryDays)}d` : '—'}</td>
          <td className="hidden py-3 pr-4 text-ink-2 lg:table-cell">{channel.daysSinceUpload == null ? '—' : channel.daysSinceUpload < 1 ? 'hoje' : `há ${Math.floor(channel.daysSinceUpload)}d`}</td>
          <td className="hidden py-3 pr-4 xl:table-cell">
            {channel.top ? (
              <a href={`https://www.youtube.com/watch?v=${channel.top.id}`} target="_blank" rel="noreferrer" className="flex max-w-xs items-center gap-2 hover:underline">
                <ScoreBadge score={channel.top.score} />
                <span className="truncate text-xs text-ink-2">{channel.top.title}</span>
              </a>
            ) : (
              '—'
            )}
          </td>
        </>
      ) : (
        <td colSpan={5} className="py-3 pr-4 text-xs text-ink-3">
          Aguardando coleta
        </td>
      )}
    </>
  );
}

function Channels() {
  const { db, analysis, mutate, connected } = useData();
  const { collect, collecting } = useCollect();
  const { toast } = useUi();
  const [params, setParams] = useSearchParams();
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const showForm = params.get('novo') === '1';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeHandle(handle);
    if (!name.trim() || normalized === '@') return;
    if (db.channels.some((channel) => channel.handle.toLowerCase() === normalized.toLowerCase())) {
      toast('Esse canal já está no radar.', 'error');
      return;
    }
    mutate((draft) => void draft.channels.push({ id: createId(), name: name.trim(), handle: normalized, note: '' }));
    setName('');
    setHandle('');
    setParams({ aba: 'canais' });
    if (connected) await collect();
  };

  const removingChannel = db.channels.find((channel) => channel.id === removing);

  return (
    <>
      {showForm ? (
        <Panel className="mb-4" title="Adicionar canal ao radar" description="A coleta começa assim que o canal é salvo (cerca de 1 minuto)">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Nome do canal">
              <Input autoFocus required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Caio Dlugosz" />
            </Field>
            <Field label="@ ou link do canal">
              <Input required value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="@canal ou youtube.com/@canal" />
            </Field>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setParams({ aba: 'canais' })}>
                Cancelar
              </Button>
              <Button type="submit" variant="primary" icon={UserPlus} loading={collecting}>
                Adicionar
              </Button>
            </div>
          </form>
        </Panel>
      ) : null}
      <Panel
        padded={false}
        title="Comparação lado a lado"
        description="Mediana de views dos últimos vídeos e ritmo de postagem de cada canal"
        actions={
          <>
            <Button size="sm" variant="ghost" icon={RefreshCw} loading={collecting} onClick={() => void collect()}>
              Coletar
            </Button>
            {!showForm ? (
              <Button size="sm" icon={Plus} onClick={() => setParams({ aba: 'canais', novo: '1' })}>
                Adicionar canal
              </Button>
            ) : null}
          </>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs text-ink-2">
                <th className="py-2.5 pl-5 font-medium">Canal</th>
                <th className="py-2.5 pr-4 text-right font-medium">Inscritos</th>
                <th className="hidden py-2.5 pr-4 text-right font-medium md:table-cell">Mediana</th>
                <th className="hidden py-2.5 pr-4 font-medium md:table-cell">Ritmo</th>
                <th className="hidden py-2.5 pr-4 font-medium lg:table-cell">Último vídeo</th>
                <th className="hidden py-2.5 pr-4 font-medium xl:table-cell">Melhor recente</th>
                <th className="w-12 py-2.5 pr-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr className="bg-accent-soft/40">
                <ChannelRow label={db.profile.name} channel={analysis?.profile ?? undefined} you />
                <td />
              </tr>
              {db.channels.map((channel) => {
                const data = analysis?.channels.get(channel.handle.toLowerCase());
                return (
                  <tr key={channel.id} className="hover:bg-hover">
                    <ChannelRow label={channel.name} channel={data ? { ...data, handle: channel.handle } : undefined} />
                    <td className="py-3 pr-3 text-right">
                      <Menu
                        trigger={({ toggle, open, id }) => <IconButton icon={MoreHorizontal} size="sm" label={`Ações de ${channel.name}`} onClick={toggle} aria-expanded={open} aria-controls={id} />}
                        items={[
                          { label: 'Abrir no YouTube', icon: ExternalLink, onSelect: () => window.open(`https://www.youtube.com/${channel.handle}`, '_blank', 'noreferrer') },
                          { label: 'Remover do radar', icon: Trash2, danger: true, onSelect: () => setRemoving(channel.id) },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {db.channels.some((channel) => analysis?.channels.get(channel.handle.toLowerCase())?.error) ? (
          <p className="border-t border-line px-5 py-3 text-xs text-down">Algum canal falhou na última coleta. Confira se o @ está certo.</p>
        ) : null}
        {!db.channels.length ? <EmptyState icon={Users} title="Nenhum concorrente no radar" action={<Button icon={Plus} onClick={() => setParams({ aba: 'canais', novo: '1' })}>Adicionar canal</Button>} /> : null}
      </Panel>
      <ConfirmDialog
        open={Boolean(removingChannel)}
        onClose={() => setRemoving(null)}
        title="Remover canal do radar?"
        description={`${removingChannel?.name ?? ''} sai da comparação e da coleta. O histórico coletado some na próxima coleta.`}
        confirmLabel="Remover"
        onConfirm={() => {
          mutate((draft) => void (draft.channels = draft.channels.filter((channel) => channel.id !== removing)));
          toast('Canal removido do radar.');
        }}
      />
    </>
  );
}

function Topics() {
  const { analysis } = useData();
  const { createPauta } = useCreate();
  const topics = analysis?.topics ?? [];
  if (!topics.length) return <Panel><EmptyState icon={Hash} title="Ainda sem temas recorrentes">Os temas aparecem quando palavras se repetem em pelo menos dois vídeos acima da mediana dos canais do radar.</EmptyState></Panel>;
  const maxHits = Math.max(...topics.map((topic) => topic.hits));
  return (
    <Panel padded={false} title="Temas que se repetem nos vídeos acima da média" description="Palavras e pares de palavras dos títulos do radar, ordenados por frequência e desempenho">
      <ul className="divide-y divide-line border-t border-line">
        {topics.map((topic) => (
          <li key={topic.term} className="grid gap-3 px-5 py-4 md:grid-cols-[220px_1fr_auto] md:items-center">
            <div>
              <p className="flex items-center gap-2 text-[15px] font-medium text-ink">
                <Hash size={15} className="text-ink-3" aria-hidden />
                {topic.label}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 w-28 rounded-full bg-sunken" aria-hidden>
                  <div className="h-full rounded-full bg-[var(--chart-2)]" style={{ width: `${(topic.hits / maxHits) * 100}%` }} />
                </div>
                <span className="text-xs text-ink-2 tabular-nums">
                  {topic.hits} de {topic.total} vídeos · média {formatScore(topic.avgScore)}
                </span>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {topic.videoIds.slice(0, 4).map((videoId) => {
                const video = analysis?.videoById.get(videoId);
                return (
                  <a key={videoId} href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" title={video?.title} className="shrink-0">
                    <Thumb videoId={videoId} className="w-28" badge={video?.score != null ? formatScore(video.score) : undefined} />
                  </a>
                );
              })}
            </div>
            <div className="flex items-center gap-2 md:justify-end">
              {topic.covered ? (
                <Badge tone="up">Já tem pauta</Badge>
              ) : (
                <Button size="sm" icon={Lightbulb} onClick={() => createPauta({ title: `Vídeo sobre ${topic.label}`, tags: [topic.label], notes: `Tema em alta no radar: ${topic.label} (${topic.hits} vídeos acima da média)` })}>
                  Criar pauta
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Saved() {
  const { db, analysis, mutate } = useData();
  const { toast } = useUi();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const videoId = parseVideoId(url);
    if (!videoId && !/^https?:\/\//.test(url)) {
      toast('Cole um link que comece com http ou https.', 'error');
      return;
    }
    const known = videoId ? analysis?.videoById.get(videoId) : undefined;
    mutate((draft) => void draft.references.unshift({ id: createId(), url, videoId, title: title.trim() || known?.title || 'Referência sem título', channel: known?.channelTitle ?? 'Link manual', note: '', savedAt: Date.now() }));
    setUrl('');
    setTitle('');
    toast('Referência salva.');
  };

  return (
    <>
      <Panel className="mb-5" title="Salvar link">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1.4fr_1fr_auto] md:items-end">
          <Field label="Link do vídeo">
            <Input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
          </Field>
          <Field label="Título para lembrar" hint="Opcional se o vídeo já está no radar">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: gancho de teste em 5 segundos" />
          </Field>
          <Button type="submit" icon={Link2} className="md:mb-5">
            Salvar
          </Button>
        </form>
      </Panel>
      {db.references.length ? (
        <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {db.references.map((reference) => {
            const video = reference.videoId ? analysis?.videoById.get(reference.videoId) : undefined;
            const usedIn = db.pautas.filter((pauta) => pauta.referenceIds.includes(reference.id));
            return (
              <article key={reference.id} className="min-w-0">
                <a href={reference.url} target="_blank" rel="noreferrer">
                  <Thumb videoId={reference.videoId} quality="hqdefault" className="rounded-xl" badge={video?.score != null ? formatScore(video.score) : undefined} />
                </a>
                <div className="mt-3 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <a href={reference.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-sm leading-snug font-medium text-ink hover:underline">
                      {reference.title}
                    </a>
                    <p className="mt-1 text-xs text-ink-2">{reference.channel}</p>
                    <p className="text-xs text-ink-3">{video ? `${formatCompact(video.views)} visualizações · ${formatAge(video.published)}` : `Salvo ${formatAge(reference.savedAt)}`}</p>
                    {usedIn.length ? <p className="mt-1 text-2xs text-info">Usada em {usedIn.length === 1 ? `"${usedIn[0]?.title}"` : `${usedIn.length} pautas`}</p> : null}
                  </div>
                  <IconButton
                    icon={Trash2}
                    size="sm"
                    label="Remover referência"
                    onClick={() => {
                      mutate((draft) => {
                        draft.references = draft.references.filter((item) => item.id !== reference.id);
                        for (const pauta of draft.pautas) pauta.referenceIds = pauta.referenceIds.filter((item) => item !== reference.id);
                      });
                      toast('Referência removida.');
                    }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Panel>
          <EmptyState icon={Bookmark} title="Nenhuma referência salva">Use o marcador nos vídeos em alta ou cole um link acima.</EmptyState>
        </Panel>
      )}
    </>
  );
}

export function Radar() {
  const { db, analysis } = useData();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((item) => item.id === params.get('aba'))?.id ?? 'alta') as Tab;

  useEffect(() => {
    if (params.get('novo') === '1' && tab !== 'canais') setParams({ aba: 'canais', novo: '1' });
  }, [params, setParams, tab]);

  const counts: Record<Tab, number> = { alta: analysis?.trending.length ?? 0, canais: db.channels.length, temas: analysis?.topics.length ?? 0, salvos: db.references.length };

  return (
    <>
      <PageHeader title="Radar" description={`${db.channels.length} ${db.channels.length === 1 ? 'canal monitorado' : 'canais monitorados'} · o selo mostra quantas vezes o vídeo superou a mediana do próprio canal`}>
        <div role="tablist" aria-label="Seções do radar" className="mt-4 flex gap-6 overflow-x-auto border-b border-line scrollbar-none">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setParams({ aba: item.id })}
              className={`relative flex h-11 shrink-0 items-center gap-1.5 text-sm transition-colors duration-150 ${tab === item.id ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}
            >
              {item.label}
              <span className="text-xs text-ink-3 tabular-nums">{counts[item.id]}</span>
              {tab === item.id ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-ink" aria-hidden /> : null}
            </button>
          ))}
        </div>
      </PageHeader>
      {tab === 'alta' ? <Trending /> : tab === 'canais' ? <Channels /> : tab === 'temas' ? <Topics /> : <Saved />}
    </>
  );
}
