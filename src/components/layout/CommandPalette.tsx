import { CornerDownLeft, FilePlus2, LibraryBig, Lightbulb, MonitorPlay, Moon, Radar, RefreshCw, Search, SquareKanban, Sun, UserPlus, type LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar, Thumb } from '@/components/ui/media';
import { matchesQuery } from '@/lib/analytics';
import { REFERENCE_KIND_LABEL, STAGE_LABEL } from '@/lib/constants';
import { formatCompact } from '@/lib/format';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav';

interface Item {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon?: LucideIcon;
  videoId?: string;
  avatar?: { src: string | null; name: string };
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { db, analysis, collect, connected } = useData();
  const { resolvedTheme, setTheme, toast } = useUi();
  const { createPauta, createReport } = useCreate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setQuery('');
      setActive(0);
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const go = (path: string) => () => navigate(path);
    const actions: Item[] = [
      { id: 'new-pauta', group: 'Ações', label: 'Nova pauta', icon: Lightbulb, run: () => createPauta() },
      { id: 'new-report', group: 'Ações', label: 'Novo relatório', icon: FilePlus2, run: createReport },
      { id: 'add-channel', group: 'Ações', label: 'Adicionar canal ao radar', icon: UserPlus, run: go('/radar?aba=canais&novo=1') },
      {
        id: 'collect',
        group: 'Ações',
        label: 'Atualizar métricas agora',
        icon: RefreshCw,
        run: () => {
          if (!connected) return;
          toast('Coleta iniciada. Leva cerca de 1 minuto.');
          void collect().then((result) => toast(result === 'done' ? 'Métricas atualizadas.' : result === 'forbidden' ? 'O token precisa da permissão Actions.' : 'A coleta está demorando; os dados aparecem quando terminar.'));
        },
      },
      { id: 'theme', group: 'Ações', label: resolvedTheme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro', icon: resolvedTheme === 'dark' ? Sun : Moon, run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') },
    ];
    const pages: Item[] = [...NAV_ITEMS, SETTINGS_ITEM].map((item) => ({ id: `page-${item.to}`, group: 'Páginas', label: item.label, icon: item.icon, run: go(item.to) }));
    const pautas: Item[] = db.pautas.map((pauta) => ({ id: `pauta-${pauta.id}`, group: 'Pautas', label: pauta.title || 'Sem título', detail: STAGE_LABEL[pauta.stage], icon: SquareKanban, keywords: pauta.tags.join(' '), run: go(`/pautas/${pauta.id}`) }));
    const videos: Item[] = (analysis?.profile?.videos ?? []).map((video) => ({ id: `video-${video.id}`, group: 'Vídeos do canal', label: video.title, detail: `${formatCompact(video.views)} views`, videoId: video.id, run: go(`/videos/${video.id}`) }));
    const channels: Item[] = db.channels.map((channel) => ({ id: `channel-${channel.id}`, group: 'Radar', label: channel.name, detail: channel.handle, avatar: { src: analysis?.channels.get(channel.handle.toLowerCase())?.avatar ?? null, name: channel.name }, keywords: channel.handle, run: go(`/radar/${encodeURIComponent(channel.handle)}`) }));
    const library: Item[] = db.references.map((reference) => ({ id: `ref-${reference.id}`, group: 'Biblioteca', label: reference.title, detail: REFERENCE_KIND_LABEL[reference.kind], icon: LibraryBig, videoId: reference.videoId ?? undefined, keywords: `${reference.tags.join(' ')} ${reference.note} ${reference.channel}`, run: go(`/biblioteca?tipo=${reference.kind}`) }));
    const trending: Item[] = (analysis?.trending ?? []).slice(0, 30).map((video) => ({ id: `trend-${video.id}`, group: 'Em alta no radar', label: video.title, detail: video.channelTitle, videoId: video.id, keywords: video.channelTitle, run: go('/radar') }));
    const all = [...actions, ...pages, ...pautas, ...library, ...videos, ...channels, ...trending];
    if (!query.trim()) return [...actions, ...pages];
    return all.filter((item) => matchesQuery(`${item.label} ${item.detail ?? ''} ${item.keywords ?? ''} ${item.group}`, query)).slice(0, 40);
  }, [analysis, collect, connected, createPauta, createReport, db, navigate, query, resolvedTheme, setTheme, toast]);

  useEffect(() => {
    setActive(0);
  }, [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className="fade-in mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-line bg-panel p-0 text-ink shadow-pop"
      aria-label="Busca e comandos"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={18} className="text-ink-3" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(items.length - 1, index + 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(0, index - 1));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              run(items[active]);
            }
          }}
          placeholder="Buscar pautas, vídeos, canais ou ações"
          className="h-13 w-full bg-transparent text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active].id}` : undefined}
        />
        <kbd className="rounded border border-line px-1.5 py-0.5 font-sans text-2xs text-ink-3">Esc</kbd>
      </div>
      <div ref={listRef} id="palette-list" role="listbox" className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
        {items.length === 0 ? <p className="px-3 py-8 text-center text-sm text-ink-2">Nada encontrado para "{query}".</p> : null}
        {items.map((item, index) => {
          const header = items[index - 1]?.group !== item.group ? item.group : null;
          return (
            <div key={item.id}>
              {header ? <p className="px-3 pt-2.5 pb-1 text-2xs font-medium tracking-wide text-ink-3 uppercase">{header}</p> : null}
              <button
                type="button"
                id={`palette-${item.id}`}
                role="option"
                aria-selected={index === active}
                data-index={index}
                onMouseMove={() => setActive(index)}
                onClick={() => run(item)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${index === active ? 'bg-hover' : ''}`}
              >
                {item.videoId ? <Thumb videoId={item.videoId} className="w-12 rounded" /> : item.avatar ? <Avatar src={item.avatar.src} name={item.avatar.name} size={24} /> : item.icon ? <item.icon size={17} className="text-ink-2" aria-hidden /> : <MonitorPlay size={17} aria-hidden />}
                <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                {item.detail ? <span className="shrink-0 text-xs text-ink-3">{item.detail}</span> : null}
                {index === active ? <CornerDownLeft size={14} className="shrink-0 text-ink-3" aria-hidden /> : null}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-2xs text-ink-3">
        <Radar size={13} aria-hidden /> Busca por início de palavra, sem acento
      </div>
    </dialog>
  );
}
