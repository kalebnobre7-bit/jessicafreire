import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CalendarDays, Eye, Lightbulb, ListChecks, Plus, Search } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/feedback';
import { Input, SegmentedControl, Select } from '@/components/ui/form';
import { Thumb } from '@/components/ui/media';
import { matchesQuery } from '@/lib/analytics';
import { STAGES, STAGE_LABEL } from '@/lib/constants';
import { createPauta } from '@/lib/database';
import { dateKey, formatAge, formatCompact, formatDate } from '@/lib/format';
import type { Pauta, Stage } from '@/lib/types';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

type View = 'quadro' | 'lista';
const VIEW_KEY = 'jf:pautas-view';
// Soltar um card dispara um clique no link logo em seguida; ignora esse clique
let lastDragEnd = 0;

function sortPautas(a: Pauta, b: Pauta): number {
  return (a.publishAt ?? '9999').localeCompare(b.publishAt ?? '9999') || b.updatedAt - a.updatedAt;
}

function DateChip({ pauta }: { pauta: Pauta }) {
  if (!pauta.publishAt) return null;
  const late = pauta.stage !== 'publicado' && pauta.publishAt < dateKey(Date.now());
  return (
    <span className={`inline-flex items-center gap-1 text-2xs ${late ? 'font-medium text-down' : 'text-ink-3'}`}>
      <CalendarDays size={12} aria-hidden />
      {late ? 'Atrasada · ' : ''}
      {formatDate(pauta.publishAt)}
    </span>
  );
}

function CardBody({ pauta }: { pauta: Pauta }) {
  const { analysis } = useData();
  const video = pauta.videoId ? analysis?.videoById.get(pauta.videoId) : null;
  const done = pauta.checklist.filter(Boolean).length;
  return (
    <>
      {pauta.videoId ? <Thumb videoId={pauta.videoId} className="mb-2.5 w-full" /> : null}
      {pauta.tags.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {pauta.tags.slice(0, 3).map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </div>
      ) : null}
      <p className="line-clamp-3 text-[13px] leading-snug font-medium text-ink">{pauta.title || 'Sem título'}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        {pauta.stage !== 'publicado' ? (
          <span className={`inline-flex items-center gap-1 text-2xs tabular-nums ${done === pauta.checklist.length ? 'text-up' : 'text-ink-3'}`}>
            <ListChecks size={12} aria-hidden />
            {done}/{pauta.checklist.length}
          </span>
        ) : null}
        <DateChip pauta={pauta} />
        {video ? (
          <span className="inline-flex items-center gap-1 text-2xs text-ink-2 tabular-nums">
            <Eye size={12} aria-hidden />
            {formatCompact(video.views)}
          </span>
        ) : null}
      </div>
    </>
  );
}

function BoardCard({ pauta }: { pauta: Pauta }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: pauta.id, data: { stage: pauta.stage } });
  return (
    <Link
      ref={setNodeRef}
      to={`/pautas/${pauta.id}`}
      {...attributes}
      {...listeners}
      aria-roledescription="Pauta arrastável"
      onClick={(event) => {
        if (Date.now() - lastDragEnd < 300) event.preventDefault();
      }}
      className={`block rounded-lg border border-line bg-panel p-3 transition-[border-color,box-shadow] duration-150 hover:border-line-strong ${isDragging ? 'opacity-40' : ''}`}
    >
      <CardBody pauta={pauta} />
    </Link>
  );
}

function QuickAdd({ stage }: { stage: Stage }) {
  const { mutate } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    mutate((db) => {
      db.pautas.unshift(createPauta({ title: title.trim(), stage }));
    });
    setTitle('');
  };
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex h-9 w-full items-center gap-2 rounded-lg px-2 text-[13px] text-ink-2 hover:bg-hover hover:text-ink">
        <Plus size={16} aria-hidden /> Adicionar
      </button>
    );
  }
  return (
    <form onSubmit={submit}>
      <Input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="Título da pauta e Enter"
        aria-label={`Nova pauta em ${STAGE_LABEL[stage]}`}
      />
    </form>
  );
}

function Column({ stage, hint, pautas }: { stage: Stage; hint: string; pautas: Pauta[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section aria-label={STAGE_LABEL[stage]} className="flex min-w-48 flex-1 basis-0 flex-col rounded-xl bg-sunken/60">
      <header className="flex items-baseline justify-between px-3 pt-3 pb-2" title={hint}>
        <h2 className="text-[13px] font-medium text-ink">{STAGE_LABEL[stage]}</h2>
        <span className="text-xs text-ink-3 tabular-nums">{pautas.length}</span>
      </header>
      <div ref={setNodeRef} className={`flex min-h-24 flex-1 flex-col gap-2 rounded-lg px-2 pb-2 transition-colors duration-150 ${isOver ? 'bg-info-soft' : ''}`}>
        {pautas.map((pauta) => (
          <BoardCard key={pauta.id} pauta={pauta} />
        ))}
        {stage !== 'publicado' ? <QuickAdd stage={stage} /> : pautas.length === 0 ? <p className="px-2 py-3 text-2xs text-ink-3">Arraste para cá o que foi ao ar.</p> : null}
      </div>
    </section>
  );
}

function Board({ pautas }: { pautas: Pauta[] }) {
  const { mutate } = useData();
  const { toast } = useUi();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] } }));
  const active = pautas.find((pauta) => pauta.id === activeId);

  const onDragEnd = ({ active: dragged, over }: DragEndEvent) => {
    setActiveId(null);
    lastDragEnd = Date.now();
    const stage = over?.id as Stage | undefined;
    if (!stage || dragged.data.current?.stage === stage) return;
    mutate((db) => {
      const pauta = db.pautas.find((item) => item.id === dragged.id);
      if (pauta) Object.assign(pauta, { stage, updatedAt: Date.now() });
    });
    toast(`Movida para ${STAGE_LABEL[stage]}.`);
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active: dragged }) => setActiveId(String(dragged.id))}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements: {
          onDragStart: () => 'Pauta selecionada. Use as setas e Espaço para soltar.',
          onDragOver: ({ over }) => (over ? `Sobre ${STAGE_LABEL[over.id as Stage]}` : 'Fora das colunas'),
          onDragEnd: ({ over }) => (over ? `Solta em ${STAGE_LABEL[over.id as Stage]}` : 'Cancelado'),
          onDragCancel: () => 'Movimento cancelado',
        },
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {STAGES.map((stage) => (
          <Column key={stage.id} stage={stage.id} hint={stage.hint} pautas={pautas.filter((pauta) => pauta.stage === stage.id).sort(sortPautas)} />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="w-68 rotate-1 rounded-lg border border-line-strong bg-panel p-3 shadow-pop">
            <CardBody pauta={active} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function List({ pautas }: { pautas: Pauta[] }) {
  const { mutate } = useData();
  const navigate = useNavigate();
  return (
    <Panel padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-2">
              <th className="py-3 pl-5 font-medium">Pauta</th>
              <th className="py-3 pr-4 font-medium">Etapa</th>
              <th className="hidden py-3 pr-4 font-medium md:table-cell">Publicação</th>
              <th className="hidden py-3 pr-4 font-medium lg:table-cell">Checklist</th>
              <th className="hidden py-3 pr-5 font-medium sm:table-cell">Atualizada</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {STAGES.flatMap((stage) =>
              pautas
                .filter((pauta) => pauta.stage === stage.id)
                .sort(sortPautas)
                .map((pauta) => (
                  <tr key={pauta.id} className="cursor-pointer hover:bg-hover" onClick={() => navigate(`/pautas/${pauta.id}`)}>
                    <td className="py-2.5 pr-4 pl-5">
                      <p className="line-clamp-1 font-medium text-ink">{pauta.title || 'Sem título'}</p>
                      {pauta.tags.length ? <p className="text-xs text-ink-3">{pauta.tags.join(' · ')}</p> : null}
                    </td>
                    <td className="py-2.5 pr-4" onClick={(event) => event.stopPropagation()}>
                      <Select
                        value={pauta.stage}
                        aria-label="Etapa"
                        className="h-8 w-36 text-[13px]"
                        onChange={(event) =>
                          mutate((db) => {
                            const item = db.pautas.find((entry) => entry.id === pauta.id);
                            if (item) Object.assign(item, { stage: event.target.value as Stage, updatedAt: Date.now() });
                          })
                        }
                      >
                        {STAGES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="hidden py-2.5 pr-4 md:table-cell">{pauta.publishAt ? <DateChip pauta={pauta} /> : <span className="text-xs text-ink-3">—</span>}</td>
                    <td className="hidden py-2.5 pr-4 text-xs tabular-nums text-ink-2 lg:table-cell">
                      {pauta.checklist.filter(Boolean).length}/{pauta.checklist.length}
                    </td>
                    <td className="hidden py-2.5 pr-5 text-xs text-ink-3 sm:table-cell">{formatAge(pauta.updatedAt)}</td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function Pautas() {
  const { db } = useData();
  const { createPauta: createAndOpen } = useCreate();
  const [view, setView] = useState<View>(() => (localStorage.getItem(VIEW_KEY) === 'lista' ? 'lista' : 'quadro'));
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => db.pautas.filter((pauta) => !query.trim() || matchesQuery(`${pauta.title} ${pauta.promise} ${pauta.tags.join(' ')}`, query)), [db.pautas, query]);
  const inProduction = db.pautas.filter((pauta) => !['ideia', 'publicado'].includes(pauta.stage)).length;

  return (
    <>
      <PageHeader
        title="Pautas"
        description={`${db.pautas.length} pautas · ${inProduction} em produção · arraste entre as etapas`}
        actions={
          <>
            <div className="relative w-full sm:w-56">
              <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar pautas" className="pl-9" aria-label="Filtrar pautas" />
            </div>
            <SegmentedControl
              label="Visualização"
              value={view}
              onChange={(value) => {
                localStorage.setItem(VIEW_KEY, value);
                setView(value);
              }}
              options={[
                { value: 'quadro', label: 'Quadro' },
                { value: 'lista', label: 'Lista' },
              ]}
            />
            <Button variant="primary" icon={Plus} onClick={() => createAndOpen()}>
              Nova pauta
            </Button>
          </>
        }
      />
      {db.pautas.length === 0 ? (
        <Panel>
          <EmptyState icon={Lightbulb} title="Nenhuma pauta ainda" action={<Button variant="primary" icon={Plus} onClick={() => createAndOpen()}>Criar a primeira pauta</Button>}>
            Pautas passam por Ideia, Roteiro, Gravação, Edição, Agendado e Publicado. Os temas em alta no Radar ajudam a escolher.
          </EmptyState>
        </Panel>
      ) : view === 'quadro' ? (
        <Board pautas={filtered} />
      ) : (
        <List pautas={filtered} />
      )}
    </>
  );
}
