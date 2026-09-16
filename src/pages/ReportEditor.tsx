import { ArrowLeft, Copy, Eye, FileChartColumn, MoreHorizontal, Plus, Printer, RefreshCw, Send, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ReportDocument } from '@/components/ReportDocument';
import { Button, ButtonLink, IconButton } from '@/components/ui/button';
import { Badge, EmptyState, Panel } from '@/components/ui/feedback';
import { Field, Input, Textarea } from '@/components/ui/form';
import { ConfirmDialog, Menu } from '@/components/ui/overlay';
import { buildInsights, buildSnapshot } from '@/lib/analytics';
import { dateKey, formatAge, formatCompact, formatScore, shiftDate } from '@/lib/format';
import type { Report, ReportSnapshot } from '@/lib/types';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

function presets(): { label: string; from: string; to: string }[] {
  const today = dateKey(Date.now());
  const [year, month] = today.split('-').map(Number) as [number, number];
  const firstThisMonth = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastPrevious = shiftDate(firstThisMonth, -1);
  return [
    { label: 'Últimos 7 dias', from: shiftDate(today, -6), to: today },
    { label: 'Últimos 28 dias', from: shiftDate(today, -27), to: today },
    { label: 'Mês passado', from: `${lastPrevious.slice(0, 7)}-01`, to: lastPrevious },
  ];
}

// Primeiro rascunho do resumo a partir dos números; o Kaleb edita depois
function draftSummary(snapshot: ReportSnapshot): string {
  const parts: string[] = [];
  const subs = snapshot.subscribers.start != null && snapshot.subscribers.end != null ? snapshot.subscribers.end - snapshot.subscribers.start : null;
  const views = snapshot.views.start != null && snapshot.views.end != null ? snapshot.views.end - snapshot.views.start : null;
  if (subs != null && views != null && views > 0) parts.push(`No período, o canal ${subs >= 0 ? `ganhou ${formatCompact(subs)}` : `perdeu ${formatCompact(Math.abs(subs))}`} inscritos e somou ${formatCompact(views)} views.`);
  if (snapshot.videos.length) {
    const best = snapshot.videos.filter((video) => video.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    parts.push(`Foram ${snapshot.videos.length} ${snapshot.videos.length === 1 ? 'vídeo publicado' : 'vídeos publicados'}.`);
    if (best?.score != null) parts.push(`O destaque foi "${best.title}", com ${formatCompact(best.views)} views, ${formatScore(best.score)} o normal do canal.`);
  } else {
    parts.push('Nenhum vídeo foi publicado no período.');
  }
  return parts.join(' ');
}

export function ReportEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { db, analysis, mutate } = useData();
  const { toast } = useUi();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const report = db.reports.find((item) => item.id === id);

  const liveSnapshot = useMemo(() => (analysis && report ? buildSnapshot(analysis, report.from, report.to) : null), [analysis, report]);
  const suggestions = useMemo(() => (analysis ? buildInsights(analysis, db).filter((insight) => insight.tone !== 'info') : []), [analysis, db]);

  if (!report) {
    return (
      <Panel>
        <EmptyState icon={FileChartColumn} title="Relatório não encontrado" action={<ButtonLink to="/relatorios">Voltar para relatórios</ButtonLink>} />
      </Panel>
    );
  }

  const update = (recipe: (draft: Report) => void) =>
    mutate((draft) => {
      const target = draft.reports.find((item) => item.id === id);
      if (!target) return;
      recipe(target);
      target.updatedAt = Date.now();
    });

  const published = report.status === 'publicado';
  const snapshot = published ? report.snapshot : liveSnapshot;
  const profile = { name: db.profile.name, handle: db.profile.handle, avatar: analysis?.profile?.avatar ?? null };

  const publish = () => {
    if (!analysis) {
      toast('Sem métricas para fixar no relatório. Rode uma coleta antes.', 'error');
      return;
    }
    update((draft) => Object.assign(draft, { status: 'publicado', snapshot: buildSnapshot(analysis, draft.from, draft.to), publishedAt: Date.now() }));
    toast('Relatório publicado. Os números ficaram fixos na data de hoje.');
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/r/${report.id}`);
    toast('Link do relatório copiado. Quem abrir precisa entrar com a senha.');
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/relatorios" className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Relatórios
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {published ? <Badge tone="up">Publicado {report.publishedAt ? formatAge(report.publishedAt) : ''}</Badge> : <Badge>Rascunho</Badge>}
          {published ? (
            <Button icon={Copy} onClick={() => void copyLink()}>
              Copiar link
            </Button>
          ) : null}
          {published ? (
            <Button variant="secondary" icon={Undo2} onClick={() => update((draft) => Object.assign(draft, { status: 'rascunho', snapshot: null, publishedAt: null }))}>
              Voltar a rascunho
            </Button>
          ) : (
            <Button variant="primary" icon={Send} onClick={publish}>
              Publicar
            </Button>
          )}
          <Menu
            trigger={({ toggle, open, id: menuId }) => <IconButton icon={MoreHorizontal} label="Mais ações" onClick={toggle} aria-expanded={open} aria-controls={menuId} />}
            items={[
              { label: 'Ver como a Jéssica', icon: Eye, onSelect: () => window.open(`${window.location.pathname}#/r/${report.id}`, '_blank') },
              ...(published ? [{ label: 'Atualizar números para hoje', icon: RefreshCw, onSelect: publish }] : []),
              { label: 'Imprimir ou salvar PDF', icon: Printer, onSelect: () => window.open(`${window.location.pathname}#/r/${report.id}?imprimir=1`, '_blank') },
              'divider',
              { label: 'Excluir relatório', icon: Trash2, danger: true, onSelect: () => setConfirmDelete(true) },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Panel title="Conteúdo">
            <div className="space-y-4">
              <Field label="Título">
                <Input value={report.title} onChange={(event) => update((draft) => void (draft.title = event.target.value))} />
              </Field>
              <div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="De">
                    <Input type="date" value={report.from} max={report.to} onChange={(event) => event.target.value && update((draft) => void (draft.from = event.target.value))} />
                  </Field>
                  <Field label="Até">
                    <Input type="date" value={report.to} min={report.from} onChange={(event) => event.target.value && update((draft) => void (draft.to = event.target.value))} />
                  </Field>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets().map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => update((draft) => Object.assign(draft, { from: preset.from, to: preset.to }))}
                      className={`h-7 rounded-full border px-2.5 text-xs transition-colors duration-150 ${report.from === preset.from && report.to === preset.to ? 'border-ink bg-ink text-canvas' : 'border-line text-ink-2 hover:border-line-strong hover:text-ink'}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {published ? <p className="mt-2 text-2xs text-warn">Publicado: mudar o período não altera os números até você usar "Atualizar números para hoje".</p> : null}
              </div>
              <Field label="Resumo">
                <Textarea value={report.summary} onChange={(event) => update((draft) => void (draft.summary = event.target.value))} placeholder="Como foi o período, em linguagem simples" />
              </Field>
              {snapshot && !report.summary.trim() ? (
                <Button size="sm" variant="ghost" icon={Sparkles} className="-mt-2 -ml-2.5" onClick={() => update((draft) => void (draft.summary = draftSummary(snapshot)))}>
                  Escrever rascunho com os números
                </Button>
              ) : null}
              <Field label="O que funcionou">
                <Textarea value={report.wins} onChange={(event) => update((draft) => void (draft.wins = event.target.value))} placeholder="Gancho, formato, tema ou horário que deu certo" />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-medium text-ink-2">Próximos passos</p>
                <ol className="space-y-2">
                  {report.recommendations.map((item, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="mt-2 w-4 shrink-0 text-right text-xs text-ink-3 tabular-nums">{index + 1}.</span>
                      <Textarea value={item} onChange={(event) => update((draft) => void (draft.recommendations[index] = event.target.value))} rows={1} placeholder="Uma ação clara para a Jéssica" className="min-h-9" aria-label={`Próximo passo ${index + 1}`} />
                      <IconButton icon={X} size="sm" label="Remover passo" className="mt-0.5" onClick={() => update((draft) => void draft.recommendations.splice(index, 1))} />
                    </li>
                  ))}
                </ol>
                <Button size="sm" variant="ghost" icon={Plus} className="mt-1 -ml-2.5" onClick={() => update((draft) => void draft.recommendations.push(''))}>
                  Adicionar passo
                </Button>
              </div>
            </div>
          </Panel>

          {suggestions.length ? (
            <Panel title="Leituras para usar no texto" description="Viram um passo com um clique; edite depois">
              <ul className="space-y-3">
                {suggestions.map((insight) => (
                  <li key={insight.id} className="rounded-lg bg-sunken p-3">
                    <p className="text-xs font-medium text-ink">{insight.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{insight.text}</p>
                    <button type="button" className="mt-1.5 text-xs font-medium text-info hover:underline" onClick={() => update((draft) => void (draft.recommendations = [...draft.recommendations.filter((entry) => entry.trim()), insight.text]))}>
                      Adicionar aos próximos passos
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <section aria-label="Pré-visualização" className="min-w-0">
          <div className="sticky top-20">
            <p className="mb-2 text-xs text-ink-3">{published ? 'Como a Jéssica vê (números fixados na publicação)' : 'Pré-visualização com os números de agora'}</p>
            <div className="rounded-xl border border-line bg-panel px-6 py-7 sm:px-10 sm:py-9">
              <ReportDocument report={report} snapshot={snapshot} profile={profile} />
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir relatório?"
        description={published ? 'Ele sai do link da Jéssica também.' : 'O rascunho será apagado do banco.'}
        confirmLabel="Excluir"
        onConfirm={() => {
          mutate((draft) => void (draft.reports = draft.reports.filter((item) => item.id !== report.id)));
          toast('Relatório excluído.');
          navigate('/relatorios');
        }}
      />
    </>
  );
}
