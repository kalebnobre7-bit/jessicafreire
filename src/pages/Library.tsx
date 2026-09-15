import { Check, ExternalLink, ImagePlus, LibraryBig, Lightbulb, ListPlus, MoreHorizontal, Pencil, Search, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { hasMedia, ReferenceMedia } from '@/components/ReferenceMedia';
import { Button, IconButton } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/feedback';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Thumb } from '@/components/ui/media';
import { Menu } from '@/components/ui/overlay';
import { matchesQuery } from '@/lib/analytics';
import { REFERENCE_KINDS, REFERENCE_KIND_LABEL, STAGE_LABEL } from '@/lib/constants';
import { createId, createPauta, parseVideoId } from '@/lib/database';
import { formatAge } from '@/lib/format';
import { deleteFile, writeBinary } from '@/lib/github';
import { compressImage, rememberImage } from '@/lib/images';
import type { Reference, ReferenceKind } from '@/lib/types';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

const URL_PATTERN = /^https?:\/\/\S+$/i;

function parseTags(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

function Composer() {
  const { analysis, mutate } = useData();
  const { toast } = useUi();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [image, setImage] = useState<{ base64: string; previewUrl: string } | null>(null);
  const [kind, setKind] = useState<ReferenceKind | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);

  const trimmed = text.trim();
  const isLink = URL_PATTERN.test(trimmed);
  const videoId = isLink ? parseVideoId(trimmed) : null;
  const knownVideo = videoId ? analysis?.videoById.get(videoId) : undefined;
  const detectedKind: ReferenceKind = image ? 'thumb' : isLink ? 'video' : 'ideia';
  const activeKind = kind ?? detectedKind;
  const needsTitle = Boolean(image) || isLink;
  const canSave = Boolean(image || trimmed) && !saving;

  const loadImage = async (file: File | undefined) => {
    if (!file?.type.startsWith('image/')) return;
    try {
      setImage(await compressImage(file));
    } catch {
      toast('Não consegui ler essa imagem.', 'error');
    }
  };

  const reset = () => {
    setText('');
    setTitle('');
    setTags('');
    setImage(null);
    setKind(null);
  };

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSave) return;
    setSaving(true);
    try {
      const id = createId();
      let imagePath: string | null = null;
      if (image) {
        imagePath = `refs/${id}.webp`;
        await writeBinary(imagePath, image.base64, 'Adiciona print à biblioteca');
        rememberImage(imagePath, image.previewUrl);
      }
      const [firstLine = '', ...rest] = trimmed.split('\n');
      const reference: Reference = {
        id,
        kind: activeKind,
        title: needsTitle ? title.trim() || knownVideo?.title || (isLink ? trimmed : 'Print sem título') : firstLine.trim(),
        note: needsTitle ? (isLink ? '' : trimmed) : rest.join('\n').trim(),
        url: isLink ? trimmed : null,
        videoId,
        image: imagePath,
        channel: knownVideo?.channelTitle ?? '',
        tags: parseTags(tags),
        savedAt: Date.now(),
      };
      mutate((db) => void db.references.unshift(reference));
      toast(`${REFERENCE_KIND_LABEL[reference.kind]} salvo na biblioteca.`);
      reset();
    } catch {
      toast('Não foi possível enviar o print. Confira a conexão com o banco.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onPaste = (event: ClipboardEvent) => {
    const file = [...event.clipboardData.files].find((item) => item.type.startsWith('image/'));
    if (!file) return;
    event.preventDefault();
    void loadImage(file);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void loadImage([...event.dataTransfer.files].find((item) => item.type.startsWith('image/')));
  };

  return (
    <form
      onSubmit={save}
      onPaste={onPaste}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`mb-6 rounded-xl border bg-panel p-4 transition-colors duration-150 ${dragging ? 'border-info bg-info-soft' : 'border-line'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        {image || videoId ? (
          <div className="relative w-full shrink-0 sm:w-56">
            {image ? <img src={image.previewUrl} alt="Pré-visualização do print" className="aspect-video w-full rounded-lg object-cover" /> : <Thumb videoId={videoId} quality="hqdefault" />}
            {image ? <IconButton icon={X} size="sm" label="Remover print" onClick={() => setImage(null)} className="absolute top-1.5 right-1.5 bg-panel/90" /> : null}
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          {image ? null : (
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void save();
              }}
              rows={2}
              placeholder="Cole um link, um print (⌘V) ou escreva uma ideia, gancho ou título. A primeira linha vira o título."
              aria-label="Nova referência"
              className="min-h-16 border-transparent bg-sunken text-[15px] hover:border-transparent focus:bg-panel"
            />
          )}
          {needsTitle ? <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={knownVideo?.title ?? 'Título para lembrar (o que chamou atenção)'} aria-label="Título da referência" /> : null}
          {image ? <Textarea value={text} onChange={(event) => setText(event.target.value)} rows={2} placeholder="Nota: o que funciona nessa thumb" aria-label="Nota do print" /> : null}
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Tipo">
            {REFERENCE_KINDS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={activeKind === item.id}
                title={item.hint}
                onClick={() => setKind(item.id)}
                className={`h-7 rounded-full border px-2.5 text-xs transition-colors duration-150 ${activeKind === item.id ? 'border-ink bg-ink text-canvas' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`}
              >
                {item.label}
              </button>
            ))}
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags, separadas por vírgula" aria-label="Tags" className="ml-auto h-7 w-full text-xs sm:w-56" />
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => void loadImage(event.target.files?.[0])} />
        <Button variant="ghost" size="sm" icon={ImagePlus} onClick={() => fileInput.current?.click()}>
          Enviar print
        </Button>
        <div className="flex items-center gap-2">
          {canSave ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              Limpar
            </Button>
          ) : null}
          <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!canSave}>
            Salvar na biblioteca
          </Button>
        </div>
      </div>
    </form>
  );
}

function ReferenceCard({ reference }: { reference: Reference }) {
  const { db, mutate } = useData();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ kind: reference.kind, title: reference.title, note: reference.note, tags: reference.tags.join(', ') });
  const usedIn = db.pautas.filter((pauta) => pauta.referenceIds.includes(reference.id));
  const openPautas = db.pautas.filter((pauta) => pauta.stage !== 'publicado' && !pauta.referenceIds.includes(reference.id)).slice(0, 8);
  const textual = !hasMedia(reference);

  const remove = () => {
    mutate((draftDb) => {
      draftDb.references = draftDb.references.filter((item) => item.id !== reference.id);
      for (const pauta of draftDb.pautas) pauta.referenceIds = pauta.referenceIds.filter((item) => item !== reference.id);
    });
    if (reference.image) void deleteFile(reference.image, 'Remove print da biblioteca').catch(() => undefined);
    toast('Removido da biblioteca.');
  };

  const toPauta = () => {
    const pauta = createPauta({ title: reference.kind === 'ideia' || reference.kind === 'titulo' ? reference.title : `Inspirado em: ${reference.title}`, notes: [reference.note, reference.url].filter(Boolean).join('\n'), tags: reference.tags, referenceIds: [reference.id] });
    mutate((draftDb) => void draftDb.pautas.unshift(pauta));
    navigate(`/pautas/${pauta.id}`);
  };

  if (editing) {
    return (
      <article className="mb-4 break-inside-avoid rounded-xl border border-info bg-panel p-3.5">
        <div className="space-y-2.5">
          <Select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as ReferenceKind })} aria-label="Tipo" className="h-8 text-[13px]">
            {REFERENCE_KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </Select>
          <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="Título" />
          <Textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="Nota" aria-label="Nota" rows={2} />
          <Input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="tags, separadas por vírgula" aria-label="Tags" />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={Check}
            onClick={() => {
              mutate((draftDb) => {
                const target = draftDb.references.find((item) => item.id === reference.id);
                if (target) Object.assign(target, { kind: draft.kind, title: draft.title.trim() || target.title, note: draft.note.trim(), tags: parseTags(draft.tags) });
              });
              setEditing(false);
            }}
          >
            Salvar
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article className="group mb-4 break-inside-avoid overflow-hidden rounded-xl border border-line bg-panel">
      {!textual ? (
        reference.url ? (
          <a href={reference.url} target="_blank" rel="noreferrer" className="block p-1.5 pb-0">
            <ReferenceMedia reference={reference} />
          </a>
        ) : (
          <div className="p-1.5 pb-0">
            <ReferenceMedia reference={reference} />
          </div>
        )
      ) : null}
      <div className="p-3.5">
        <div className="flex items-center gap-2">
          <Badge tone={reference.kind === 'ideia' ? 'accent' : reference.kind === 'thumb' ? 'info' : 'neutral'}>{REFERENCE_KIND_LABEL[reference.kind]}</Badge>
          {reference.channel ? <span className="truncate text-2xs text-ink-3">{reference.channel}</span> : null}
          <div className="ml-auto flex items-center opacity-100 transition-opacity duration-150 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
            <Menu
              trigger={({ toggle, open, id }) => <IconButton icon={MoreHorizontal} size="sm" label="Ações" onClick={toggle} aria-expanded={open} aria-controls={id} />}
              items={[
                { label: 'Virar pauta', icon: Lightbulb, onSelect: toPauta },
                ...openPautas.map((pauta) => ({
                  label: `Usar em "${pauta.title.slice(0, 32)}${pauta.title.length > 32 ? '…' : ''}"`,
                  icon: ListPlus,
                  hint: STAGE_LABEL[pauta.stage],
                  onSelect: () => {
                    mutate((draftDb) => void draftDb.pautas.find((item) => item.id === pauta.id)?.referenceIds.push(reference.id));
                    toast('Referência adicionada à pauta.');
                  },
                })),
                ...(reference.url ? [{ label: 'Abrir link', icon: ExternalLink, onSelect: () => window.open(reference.url ?? '', '_blank', 'noreferrer') }] : []),
                { label: 'Editar', icon: Pencil, onSelect: () => setEditing(true) },
                'divider' as const,
                { label: 'Excluir', icon: Trash2, danger: true, onSelect: remove },
              ]}
            />
          </div>
        </div>
        <p className={`mt-2 text-ink ${textual ? 'text-[17px] leading-snug font-medium' : 'line-clamp-3 text-sm font-medium'}`}>{reference.title}</p>
        {reference.note ? <p className="mt-1.5 line-clamp-6 text-[13px] leading-relaxed whitespace-pre-line text-ink-2">{reference.note}</p> : null}
        {reference.tags.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {reference.tags.map((tag) => (
              <span key={tag} className="rounded-md bg-sunken px-1.5 py-0.5 text-2xs text-ink-2">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        <p className="mt-2.5 text-2xs text-ink-3">
          Salvo {formatAge(reference.savedAt)}
          {usedIn.length ? <span className="text-info"> · usado em {usedIn.length === 1 ? `"${usedIn[0]?.title}"` : `${usedIn.length} pautas`}</span> : null}
        </p>
      </div>
    </article>
  );
}

export function Library() {
  const { db } = useData();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const kindFilter = (REFERENCE_KINDS.find((item) => item.id === params.get('tipo'))?.id ?? 'todos') as ReferenceKind | 'todos';
  const tagFilter = params.get('tag');

  const counts = useMemo(() => Object.fromEntries(REFERENCE_KINDS.map((item) => [item.id, db.references.filter((reference) => reference.kind === item.id).length])) as Record<ReferenceKind, number>, [db.references]);
  const topTags = useMemo(() => {
    const frequency = new Map<string, number>();
    for (const reference of db.references) for (const tag of reference.tags) frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
    return [...frequency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag]) => tag);
  }, [db.references]);

  const items = db.references.filter((reference) => (kindFilter === 'todos' || reference.kind === kindFilter) && (!tagFilter || reference.tags.includes(tagFilter)) && (!query.trim() || matchesQuery(`${reference.title} ${reference.note} ${reference.channel} ${reference.tags.join(' ')}`, query)));

  const setFilter = (next: { tipo?: string | null; tag?: string | null }) => {
    const merged = { tipo: kindFilter === 'todos' ? null : kindFilter, tag: tagFilter, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter((entry): entry is [string, string] => Boolean(entry[1]))));
  };

  return (
    <>
      <PageHeader title="Biblioteca" description={`${db.references.length} ${db.references.length === 1 ? 'referência' : 'referências'} para usar nas pautas: thumbs, vídeos, ideias, ganchos, títulos e formatos`} />
      <Composer />

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line">
        <div role="tablist" aria-label="Tipo de referência" className="-mb-px flex gap-5 overflow-x-auto scrollbar-none">
          {[{ id: 'todos', plural: 'Tudo', count: db.references.length }, ...REFERENCE_KINDS.map((item) => ({ id: item.id, plural: item.plural, count: counts[item.id] }))].map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={kindFilter === item.id}
              onClick={() => setFilter({ tipo: item.id === 'todos' ? null : item.id })}
              className={`flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-sm transition-colors duration-150 ${kindFilter === item.id ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
            >
              {item.plural}
              <span className="text-xs text-ink-3 tabular-nums">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="relative mb-2 ml-auto w-full sm:w-56">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na biblioteca" className="h-8 pl-8 text-[13px]" aria-label="Buscar na biblioteca" />
        </div>
      </div>

      {topTags.length ? (
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          {topTags.map((tag) => (
            <button key={tag} type="button" aria-pressed={tagFilter === tag} onClick={() => setFilter({ tag: tagFilter === tag ? null : tag })} className={`h-7 rounded-full px-2.5 text-xs transition-colors duration-150 ${tagFilter === tag ? 'bg-ink text-canvas' : 'bg-sunken text-ink-2 hover:text-ink'}`}>
              #{tag}
            </button>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 2xl:columns-4">
          {items.map((reference) => (
            <ReferenceCard key={reference.id} reference={reference} />
          ))}
        </div>
      ) : (
        <Panel>
          <EmptyState icon={LibraryBig} title={db.references.length ? 'Nada com esse filtro' : 'Biblioteca vazia'}>
            {db.references.length ? 'Tente outro tipo, tag ou busca.' : 'Cole acima um link, um print de thumb ou escreva uma ideia. No Radar, o marcador salva vídeos em alta direto aqui.'}
          </EmptyState>
        </Panel>
      )}
    </>
  );
}
