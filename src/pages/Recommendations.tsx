import { BookmarkPlus, ChevronDown, CircleAlert, Clapperboard, ExternalLink, Image, KeyRound, Lightbulb, Plus, Sparkles, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { Thumb } from '@/components/ui/media';
import { DATA_REPO } from '@/lib/constants';
import { createId, createPauta } from '@/lib/database';
import { formatAge, formatDate } from '@/lib/format';
import { buildRecommendations, RECOMMENDATION_LABEL, type Recommendation } from '@/lib/recommendations';
import type { AiIdea, AiRun } from '@/lib/types';
import { useAiIdeas } from '@/hooks/useAiIdeas';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_key: 'A chave da Anthropic configurada no GitHub foi recusada. Gere uma nova e troque o secret.',
  rate_limited: 'A API da Anthropic pediu uma pausa. Tente de novo em alguns minutos.',
};

function KeySetup() {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn-soft p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <KeyRound size={16} aria-hidden /> Falta a chave da Anthropic (uma vez só)
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
        <li>
          Crie uma chave em{' '}
          <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-info hover:underline">
            console.anthropic.com
          </a>
        </li>
        <li>
          Cole no{' '}
          <a href={`https://github.com/${DATA_REPO}/settings/secrets/actions/new`} target="_blank" rel="noreferrer" className="text-info hover:underline">
            secret do repositório de dados
          </a>{' '}
          com o nome <code className="rounded bg-panel px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>
        </li>
        <li>Volte aqui e gere de novo. A chave fica no GitHub, nunca no navegador.</li>
      </ol>
    </div>
  );
}

function IdeaCard({ idea, onPauta, onSave, onDismiss, saved }: { idea: AiIdea; onPauta: () => void; onSave: () => void; onDismiss: () => void; saved: boolean }) {
  return (
    <article className="flex flex-col rounded-xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-2">
        <Badge tone="accent" icon={Clapperboard}>
          {idea.format}
        </Badge>
        <button type="button" onClick={onDismiss} aria-label="Dispensar ideia" title="Dispensar" className="-mt-1 -mr-1 rounded-full p-1.5 text-ink-3 hover:bg-hover hover:text-ink">
          <X size={15} aria-hidden />
        </button>
      </div>
      <h3 className="mt-2.5 text-base leading-snug font-medium text-ink">{idea.title}</h3>
      <blockquote className="mt-2.5 rounded-lg bg-sunken px-3 py-2 text-[13px] leading-relaxed text-ink">
        <span className="mb-0.5 block text-2xs font-medium tracking-wide text-ink-3 uppercase">Gancho</span>
        {idea.hook}
      </blockquote>
      <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{idea.angle}</p>
      <p className="mt-2 text-xs leading-relaxed text-ink-2">
        <span className="font-medium text-ink">Por que: </span>
        {idea.why}
      </p>
      <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-ink-2">
        <Image size={14} className="mt-px shrink-0 text-ink-3" aria-hidden />
        {idea.thumbnail}
      </p>
      {idea.referenceVideoIds.length ? (
        <div className="mt-3 flex gap-1.5">
          {idea.referenceVideoIds.slice(0, 3).map((videoId) => (
            <a key={videoId} href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" title="Vídeo que inspirou a ideia">
              <Thumb videoId={videoId} className="w-20 rounded" />
            </a>
          ))}
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" variant="primary" icon={Lightbulb} onClick={onPauta}>
          Virar pauta
        </Button>
        <Button size="sm" icon={BookmarkPlus} onClick={onSave} disabled={saved}>
          {saved ? 'Na biblioteca' : 'Salvar ideia'}
        </Button>
      </div>
    </article>
  );
}

function AiSection() {
  const { db, mutate } = useData();
  const { toast } = useUi();
  const navigate = useNavigate();
  const { ensureVideoReference } = useCreate();
  const { runs, generating, generate } = useAiIdeas();
  const [focus, setFocus] = useState('');

  const latest = runs?.[0];
  const lastOk = runs?.find((run) => run.status === 'ok');
  const dismissed = new Set(db.dismissed);
  const savedTitles = new Set(db.references.map((reference) => reference.title));
  const visible = (lastOk?.ideas ?? []).filter((idea) => !dismissed.has(idea.id));
  const older = (runs ?? []).filter((run) => run.status === 'ok' && run.id !== lastOk?.id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    toast('Gerando ideias no GitHub. Leva cerca de 1 minuto.');
    const result = await generate(focus.trim());
    if (result === 'forbidden') toast('O token precisa da permissão Actions para gerar ideias.', 'error');
    else if (result === 'failed') toast('Não foi possível iniciar a geração.', 'error');
    else if (result === 'slow') toast('A geração está demorando. As ideias aparecem aqui quando terminar.');
  };

  const toPauta = (idea: AiIdea) => {
    const referenceIds = idea.referenceVideoIds.map((videoId) => ensureVideoReference(videoId)).filter((id): id is string => Boolean(id));
    const pauta = createPauta({ title: idea.title, promise: idea.angle, notes: `Por que: ${idea.why}\nThumb: ${idea.thumbnail}\nFormato: ${idea.format}`, referenceIds });
    pauta.sections[0] = { ...pauta.sections[0]!, body: idea.hook };
    mutate((draft) => {
      draft.pautas.unshift(pauta);
      draft.dismissed.push(idea.id);
    });
    navigate(`/pautas/${pauta.id}`);
  };

  const saveIdea = (idea: AiIdea) => {
    mutate((draft) => void draft.references.unshift({ id: createId(), kind: 'ideia', title: idea.title, note: `Gancho: ${idea.hook}\n\n${idea.angle}\n\nThumb: ${idea.thumbnail}`, url: null, videoId: null, image: null, channel: 'Ideia da IA', tags: ['ia'], savedAt: Date.now() }));
    toast('Ideia salva na biblioteca.');
  };

  return (
    <Panel
      title={
        <span className="flex items-center gap-2">
          <Sparkles size={17} className="text-accent" aria-hidden /> Ideias com IA
        </span>
      }
      description="O Claude lê o canal da Jéssica, os concorrentes, as pautas e a biblioteca, e sugere vídeos com título, gancho e ângulo"
    >
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <Input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Foco opcional: ex. IA grátis para TikTok Shop, vídeos sem aparecer" aria-label="Foco da rodada" className="flex-1" />
        <Button type="submit" variant="primary" icon={Sparkles} loading={generating}>
          {generating ? 'Gerando… cerca de 1 min' : 'Gerar ideias'}
        </Button>
      </form>

      <div className="mt-5 space-y-4">
        {runs === null ? <Skeleton className="h-40" /> : null}
        {latest?.status === 'error' && !generating ? (
          latest.error === 'missing_key' ? (
            <KeySetup />
          ) : (
            <p className="flex items-center gap-2 rounded-lg bg-down-soft px-3 py-2.5 text-[13px] text-down" role="alert">
              <CircleAlert size={16} aria-hidden />
              {ERROR_MESSAGES[latest.error ?? ''] ?? `A última geração falhou: ${latest.error}`}
            </p>
          )
        ) : null}
        {runs && !runs.length && !generating ? <p className="text-[13px] text-ink-2">Nenhuma ideia gerada ainda. Na primeira vez, o sistema pede a chave da Anthropic.</p> : null}
        {generating ? (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="hidden h-72 2xl:block" />
          </div>
        ) : null}
        {lastOk && !generating ? (
          <>
            <p className="text-xs text-ink-3">
              Rodada de {formatDate(lastOk.createdAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {lastOk.focus ? ` · foco: ${lastOk.focus}` : ''} · {visible.length} de {lastOk.ideas.length} ideias abertas
            </p>
            {visible.length ? (
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {visible.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} saved={savedTitles.has(idea.title)} onPauta={() => toPauta(idea)} onSave={() => saveIdea(idea)} onDismiss={() => mutate((draft) => void draft.dismissed.push(idea.id))} />
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink-2">Todas as ideias desta rodada viraram pauta ou foram dispensadas. Gere uma nova rodada.</p>
            )}
          </>
        ) : null}
        {older.length ? <OlderRuns runs={older} /> : null}
      </div>
    </Panel>
  );
}

function OlderRuns({ runs }: { runs: AiRun[] }) {
  return (
    <details className="group rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] text-ink-2 hover:text-ink">
        Rodadas anteriores ({runs.length})
        <ChevronDown size={16} className="transition-transform duration-150 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="divide-y divide-line border-t border-line">
        {runs.map((run) => (
          <div key={run.id} className="px-4 py-3">
            <p className="text-xs text-ink-3">
              {formatAge(run.createdAt)}
              {run.focus ? ` · foco: ${run.focus}` : ''}
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[13px] text-ink-2">
              {run.ideas.map((idea) => (
                <li key={idea.id}>{idea.title}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function RecommendationRow({ recommendation }: { recommendation: Recommendation }) {
  const { db, mutate } = useData();
  const navigate = useNavigate();
  const { createPauta: createAndOpen, ensureVideoReference } = useCreate();
  const reference = recommendation.referenceId ? db.references.find((item) => item.id === recommendation.referenceId) : undefined;

  const act = () => {
    if (!recommendation.pauta) {
      createAndOpen();
      return;
    }
    const referenceIds = recommendation.pauta.referenceIds ?? recommendation.videoIds.slice(0, 1).map((videoId) => ensureVideoReference(videoId)).filter((id): id is string => Boolean(id));
    const pauta = createPauta({ ...recommendation.pauta, referenceIds });
    mutate((draft) => {
      draft.pautas.unshift(pauta);
      draft.dismissed.push(recommendation.id);
    });
    navigate(`/pautas/${pauta.id}`);
  };

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
      {recommendation.videoIds.length ? (
        <div className="flex shrink-0 gap-1.5">
          {recommendation.videoIds.slice(0, 2).map((videoId) => (
            <a key={videoId} href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noreferrer" className="relative">
              <Thumb videoId={videoId} className="w-28" />
              <ExternalLink size={12} className="absolute top-1 right-1 text-[oklch(0.98_0_0)] drop-shadow" aria-hidden />
            </a>
          ))}
        </div>
      ) : reference ? null : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
          <Lightbulb size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Badge tone={recommendation.kind === 'ritmo' ? 'down' : recommendation.kind === 'adaptar' ? 'accent' : recommendation.kind === 'repetir' || recommendation.kind === 'seu-tema' ? 'up' : 'neutral'}>{RECOMMENDATION_LABEL[recommendation.kind]}</Badge>
        <p className="mt-1.5 text-sm font-medium text-ink">{recommendation.title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{recommendation.reason}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button size="sm" icon={recommendation.pauta ? Lightbulb : Plus} onClick={act}>
          {recommendation.pauta ? 'Virar pauta' : 'Nova pauta'}
        </Button>
        <button type="button" onClick={() => mutate((draft) => void draft.dismissed.push(recommendation.id))} aria-label="Dispensar sugestão" title="Dispensar" className="rounded-full p-2 text-ink-3 hover:bg-hover hover:text-ink">
          <X size={16} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export function Recommendations() {
  const { db, analysis, mutate } = useData();
  const recommendations = useMemo(() => buildRecommendations(analysis, db), [analysis, db]);
  const hiddenCount = db.dismissed.filter((id) => !id.startsWith('ai-')).length;

  return (
    <>
      <PageHeader title="O que gravar" description="Ideias da IA e sugestões calculadas a partir do canal, do radar e da biblioteca" />
      <div className="space-y-5">
        <AiSection />
        <Panel
          title="Sugestões dos dados"
          description="Atualizam sozinhas a cada coleta; dispense o que não fizer sentido"
          actions={
            hiddenCount ? (
              <Button size="sm" variant="ghost" onClick={() => mutate((draft) => void (draft.dismissed = draft.dismissed.filter((id) => id.startsWith('ai-'))))}>
                Mostrar {hiddenCount} dispensadas
              </Button>
            ) : null
          }
        >
          {recommendations.length ? (
            <ul className="divide-y divide-line">
              {recommendations.map((recommendation) => (
                <RecommendationRow key={recommendation.id} recommendation={recommendation} />
              ))}
            </ul>
          ) : (
            <EmptyState icon={Lightbulb} title="Sem sugestões agora">
              Elas aparecem quando um vídeo do radar ou do canal foge da mediana, um tema cresce ou uma ideia fica parada na biblioteca.
            </EmptyState>
          )}
        </Panel>
      </div>
    </>
  );
}
