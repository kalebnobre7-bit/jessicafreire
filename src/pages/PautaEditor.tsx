import { ArrowLeft, Check, Copy, Link2, MoreHorizontal, Plus, SquareKanban, Trash2, X } from 'lucide-react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { Badge, EmptyState, Panel, ScoreBadge } from '@/components/ui/feedback';
import { BareInput, Field, Input, Select, Textarea } from '@/components/ui/form';
import { Thumb } from '@/components/ui/media';
import { ConfirmDialog, Menu } from '@/components/ui/overlay';
import { findPublishedMatch } from '@/lib/analytics';
import { CHECKLIST, DEFAULT_SECTIONS, STAGES } from '@/lib/constants';
import { createId, createPauta } from '@/lib/database';
import { formatAge, formatCompact, formatDate } from '@/lib/format';
import type { Pauta, Stage } from '@/lib/types';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

const WORDS_PER_MINUTE = 150;

function TagsField({ pauta, update, suggestions }: { pauta: Pauta; update: (recipe: (pauta: Pauta) => void) => void; suggestions: string[] }) {
  const [value, setValue] = useState('');
  const add = (tag: string) => {
    const clean = tag.trim();
    if (!clean || pauta.tags.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
    update((draft) => {
      draft.tags.push(clean);
    });
    setValue('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(value);
    } else if (event.key === 'Backspace' && !value && pauta.tags.length) {
      update((draft) => {
        draft.tags.pop();
      });
    }
  };
  const available = suggestions.filter((tag) => !pauta.tags.some((item) => item.toLowerCase() === tag.toLowerCase())).slice(0, 5);
  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-2 py-1.5 focus-within:border-info">
        {pauta.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-sunken py-0.5 pr-1 pl-2 text-xs text-ink">
            {tag}
            <button type="button" aria-label={`Remover ${tag}`} onClick={() => update((draft) => void (draft.tags = draft.tags.filter((item) => item !== tag)))} className="rounded p-0.5 text-ink-3 hover:bg-hover hover:text-ink">
              <X size={12} aria-hidden />
            </button>
          </span>
        ))}
        <input value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={onKeyDown} onBlur={() => add(value)} placeholder={pauta.tags.length ? '' : 'Adicionar tag'} aria-label="Adicionar tag" className="h-6 min-w-20 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none" />
      </div>
      {available.length ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-2xs text-ink-3">Em alta:</span>
          {available.map((tag) => (
            <button key={tag} type="button" onClick={() => add(tag)} className="inline-flex items-center gap-0.5 rounded-full border border-line px-2 py-0.5 text-2xs text-ink-2 hover:border-line-strong hover:text-ink">
              <Plus size={11} aria-hidden />
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PautaEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { db, analysis, mutate } = useData();
  const { toast } = useUi();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pauta = db.pautas.find((item) => item.id === id);

  const update = (recipe: (draft: Pauta) => void) =>
    mutate((draft) => {
      const target = draft.pautas.find((item) => item.id === id);
      if (!target) return;
      recipe(target);
      target.updatedAt = Date.now();
    });

  const words = useMemo(() => (pauta ? pauta.sections.map((section) => section.body).join(' ').split(/\s+/).filter(Boolean).length : 0), [pauta]);
  const profileVideos = analysis?.profile?.videos ?? [];
  const video = pauta?.videoId ? analysis?.videoById.get(pauta.videoId) : null;
  const match = pauta && !pauta.videoId ? findPublishedMatch(pauta, profileVideos) : null;

  if (!pauta) {
    return (
      <Panel>
        <EmptyState icon={SquareKanban} title="Pauta não encontrada" action={<ButtonLink to="/pautas">Voltar para pautas</ButtonLink>}>
          Ela pode ter sido excluída em outro aparelho.
        </EmptyState>
      </Panel>
    );
  }

  const stageIndex = STAGES.findIndex((stage) => stage.id === pauta.stage);
  const linkedReferences = pauta.referenceIds.map((referenceId) => db.references.find((reference) => reference.id === referenceId)).filter((reference) => reference !== undefined);
  const availableReferences = db.references.filter((reference) => !pauta.referenceIds.includes(reference.id));

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link to="/pautas" className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Pautas
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-ink-3 sm:inline">Editada {formatAge(pauta.updatedAt)}</span>
          <Menu
            trigger={({ toggle, open, id: menuId }) => <IconButton icon={MoreHorizontal} label="Mais ações" onClick={toggle} aria-expanded={open} aria-controls={menuId} />}
            items={[
              {
                label: 'Duplicar pauta',
                icon: Copy,
                onSelect: () => {
                  const copy = createPauta({ ...structuredClone(pauta), id: createId(), title: `${pauta.title} (cópia)`, stage: 'ideia', videoId: null, createdAt: Date.now(), updatedAt: Date.now() });
                  mutate((draft) => void draft.pautas.unshift(copy));
                  navigate(`/pautas/${copy.id}`);
                },
              },
              'divider',
              { label: 'Excluir pauta', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <ol className="mb-4 flex flex-wrap items-center gap-1" aria-label="Etapas">
            {STAGES.map((stage, index) => (
              <li key={stage.id}>
                <button
                  type="button"
                  onClick={() => update((draft) => void (draft.stage = stage.id))}
                  aria-current={stage.id === pauta.stage ? 'step' : undefined}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors duration-150 ${stage.id === pauta.stage ? 'bg-ink text-canvas' : index < stageIndex ? 'text-ink hover:bg-hover' : 'text-ink-3 hover:bg-hover hover:text-ink-2'}`}
                >
                  {index < stageIndex ? <Check size={12} aria-hidden /> : null}
                  {stage.label}
                </button>
              </li>
            ))}
          </ol>

          <BareInput value={pauta.title} onChange={(event) => update((draft) => void (draft.title = event.target.value))} placeholder="Título da pauta" aria-label="Título" className="py-1 text-2xl font-medium tracking-[-0.01em]" />

          <Field label="Promessa para a audiência" className="mt-5" hint="Em uma frase: o que a pessoa ganha assistindo. Vira a base do título e da thumb.">
            <Textarea value={pauta.promise} onChange={(event) => update((draft) => void (draft.promise = event.target.value))} placeholder="Ex.: descobrir se dá para criar 10 vídeos de produto com um comando só" />
          </Field>

          <section className="mt-8" aria-labelledby="roteiro">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 id="roteiro" className="text-[15px] font-medium">Roteiro</h2>
              <span className="text-xs text-ink-3 tabular-nums">
                {words} palavras{words ? ` · ~${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min falados` : ''}
              </span>
            </div>
            <div className="space-y-4">
              {pauta.sections.map((section, index) => (
                <div key={section.id} className="rounded-xl border border-line bg-panel p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-2xs font-medium text-accent-ink tabular-nums">{index + 1}</span>
                    <BareInput value={section.label} onChange={(event) => update((draft) => void (draft.sections[index]!.label = event.target.value))} aria-label="Nome da seção" className="text-sm font-medium" />
                    {pauta.sections.length > 1 ? <IconButton icon={X} size="sm" label={`Remover seção ${section.label}`} onClick={() => update((draft) => void draft.sections.splice(index, 1))} /> : null}
                  </div>
                  <Textarea
                    value={section.body}
                    onChange={(event) => update((draft) => void (draft.sections[index]!.body = event.target.value))}
                    placeholder={DEFAULT_SECTIONS.find((item) => item.label === section.label)?.placeholder ?? 'Escreva esta parte do roteiro'}
                    aria-label={`Texto da seção ${section.label}`}
                    className="min-h-24 border-transparent bg-sunken hover:border-transparent focus:bg-panel"
                  />
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" icon={Plus} className="mt-3" onClick={() => update((draft) => void draft.sections.push({ id: createId(), label: 'Nova seção', body: '' }))}>
              Adicionar seção
            </Button>
          </section>

          <Field label="Notas de produção" className="mt-8">
            <Textarea value={pauta.notes} onChange={(event) => update((draft) => void (draft.notes = event.target.value))} placeholder="Produto, links, ideias de thumb, observações para a edição" />
          </Field>
        </div>

        <aside className="space-y-4">
          <Panel title="Planejamento">
            <div className="space-y-4">
              <Field label="Etapa">
                <Select value={pauta.stage} onChange={(event) => update((draft) => void (draft.stage = event.target.value as Stage))}>
                  {STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Gravação">
                  <Input type="date" value={pauta.recordAt ?? ''} onChange={(event) => update((draft) => void (draft.recordAt = event.target.value || null))} />
                </Field>
                <Field label="Publicação">
                  <Input type="date" value={pauta.publishAt ?? ''} onChange={(event) => update((draft) => void (draft.publishAt = event.target.value || null))} />
                </Field>
              </div>
              <Field label="Tags">
                <TagsField pauta={pauta} update={update} suggestions={(analysis?.topics ?? []).map((topic) => topic.label)} />
              </Field>
            </div>
          </Panel>

          <Panel title="Checklist" description={`${pauta.checklist.filter(Boolean).length} de ${CHECKLIST.length} concluídos`}>
            <ul className="space-y-0.5">
              {CHECKLIST.map((item, index) => (
                <li key={item}>
                  <label className="-mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-hover">
                    <input type="checkbox" checked={pauta.checklist[index] ?? false} onChange={(event) => update((draft) => void (draft.checklist[index] = event.target.checked))} className="size-4 accent-[var(--accent)]" />
                    <span className={`text-sm ${pauta.checklist[index] ? 'text-ink-3 line-through' : 'text-ink'}`}>{item}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Referências" description="Vídeos que inspiram esta pauta">
            {linkedReferences.length ? (
              <ul className="mb-3 space-y-2.5">
                {linkedReferences.map((reference) => (
                  <li key={reference.id} className="flex items-center gap-3">
                    <a href={reference.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
                      <Thumb videoId={reference.videoId} className="w-20" />
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-xs text-ink">{reference.title}</span>
                        <span className="text-2xs text-ink-3">{reference.channel}</span>
                      </span>
                    </a>
                    <IconButton icon={X} size="sm" label="Remover referência da pauta" onClick={() => update((draft) => void (draft.referenceIds = draft.referenceIds.filter((item) => item !== reference.id)))} />
                  </li>
                ))}
              </ul>
            ) : null}
            {availableReferences.length ? (
              <Select value="" onChange={(event) => event.target.value && update((draft) => void draft.referenceIds.push(event.target.value))} aria-label="Adicionar referência">
                <option value="">Adicionar referência salva…</option>
                {availableReferences.map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.title.slice(0, 70)}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="text-xs text-ink-2">
                Salve vídeos no <Link to="/radar?aba=salvos" className="text-info hover:underline">Radar</Link> para usar aqui.
              </p>
            )}
          </Panel>

          <Panel title="Vídeo publicado">
            {video ? (
              <div>
                <Link to={`/videos/${video.id}`} className="group block">
                  <Thumb videoId={video.id} />
                  <p className="mt-2 line-clamp-2 text-sm text-ink group-hover:underline">{video.title}</p>
                </Link>
                <div className="mt-2 flex items-center gap-2 text-xs text-ink-2">
                  <span className="tabular-nums">{formatCompact(video.views)} views</span>
                  <ScoreBadge score={video.score} />
                  <span>· {formatDate(video.published)}</span>
                </div>
                <Button variant="ghost" size="sm" className="mt-2 -ml-2.5" onClick={() => update((draft) => void (draft.videoId = null))}>
                  Desligar vídeo
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {match ? (
                  <div className="rounded-lg bg-info-soft p-3">
                    <p className="text-xs text-info">Parece já publicada como</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink">{match.title}</p>
                    <Button size="sm" icon={Link2} className="mt-2" onClick={() => update((draft) => Object.assign(draft, { videoId: match.id, stage: 'publicado' }))}>
                      Ligar e marcar publicada
                    </Button>
                  </div>
                ) : null}
                {profileVideos.length ? (
                  <Select value="" onChange={(event) => event.target.value && update((draft) => Object.assign(draft, { videoId: event.target.value, stage: 'publicado' }))} aria-label="Ligar vídeo do canal">
                    <option value="">Ligar a um vídeo do canal…</option>
                    {profileVideos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatDate(item.published)} · {item.title.slice(0, 60)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-xs text-ink-2">Os vídeos aparecem depois da primeira coleta de métricas.</p>
                )}
                {pauta.stage === 'publicado' ? <Badge tone="warn">Publicada sem vídeo ligado</Badge> : null}
              </div>
            )}
          </Panel>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir pauta?"
        description={`"${pauta.title || 'Sem título'}" e o roteiro dela serão apagados do banco.`}
        confirmLabel="Excluir"
        onConfirm={() => {
          mutate((draft) => {
            draft.pautas = draft.pautas.filter((item) => item.id !== pauta.id);
          });
          toast('Pauta excluída.');
          navigate('/pautas');
        }}
      />
    </>
  );
}
