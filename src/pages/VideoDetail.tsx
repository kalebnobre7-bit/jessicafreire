import { ArrowLeft, ExternalLink, Link2, SquareKanban, Unlink } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { LineChart } from '@/components/charts';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState, Panel, ScoreBadge } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { findPublishedMatch } from '@/lib/analytics';
import { STAGE_LABEL } from '@/lib/constants';
import { formatAge, formatCompact, formatDate, formatNumber, formatPercent } from '@/lib/format';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

export function VideoDetail() {
  const { id = '' } = useParams();
  const { db, analysis, mutate } = useData();
  const { toast } = useUi();
  const profile = analysis?.profile;
  const video = profile?.videos.find((item) => item.id === id);
  const linked = db.pautas.find((pauta) => pauta.videoId === id);
  const suggestion = useMemo(() => {
    if (!video || linked) return null;
    return db.pautas.find((pauta) => !pauta.videoId && findPublishedMatch(pauta, [video])) ?? null;
  }, [db.pautas, linked, video]);

  if (!profile || !video) {
    return (
      <Panel>
        <EmptyState icon={SquareKanban} title="Vídeo fora da coleta" action={<ButtonLink to="/videos">Voltar para vídeos</ButtonLink>}>
          O sistema acompanha os últimos 15 vídeos do canal. Esse vídeo não está mais no feed ou ainda não foi coletado.
        </EmptyState>
      </Panel>
    );
  }

  const ranked = [...profile.videos].sort((a, b) => b.views - a.views);
  const position = ranked.findIndex((item) => item.id === video.id) + 1;
  const linkPauta = (pautaId: string) => {
    mutate((draft) => {
      for (const pauta of draft.pautas) if (pauta.videoId === video.id) pauta.videoId = null;
      const pauta = draft.pautas.find((item) => item.id === pautaId);
      if (pauta) Object.assign(pauta, { videoId: video.id, stage: 'publicado', updatedAt: Date.now() });
    });
    toast('Pauta ligada ao vídeo e marcada como publicada.');
  };

  const stats = [
    { label: 'Views', value: formatNumber(video.views), detail: video.gained24h == null ? 'ganho diário a partir do 2º dia' : `+${formatNumber(video.gained24h)} desde ontem` },
    { label: 'Likes', value: formatNumber(video.likes), detail: video.likeRate == null ? '' : `${formatPercent(video.likeRate)} das views` },
    { label: 'Posição', value: `${position}º`, detail: `entre os últimos ${profile.videos.length}` },
    { label: 'Mediana do canal', value: formatCompact(profile.baseline), detail: video.score == null ? 'vídeo com menos de 3 dias' : `este vídeo: ${video.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x` },
  ];

  return (
    <>
      <Link to="/videos" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Vídeos do canal
      </Link>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="aspect-video bg-sunken">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`}
                title={video.title}
                className="size-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <ScoreBadge score={video.score} />
                <span className="text-xs text-ink-3">
                  Publicado em {formatDate(video.published, { day: 'numeric', month: 'long', year: 'numeric' })} · {formatAge(video.published)}
                </span>
              </div>
              <h1 className="mt-2 text-xl font-medium text-ink">{video.title}</h1>
              <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[13px] text-info hover:underline">
                Abrir no YouTube <ExternalLink size={13} aria-hidden />
              </a>
            </div>
          </div>
          <Panel title="Views ao longo do tempo" description="Contagem pública registrada a cada coleta">
            <LineChart points={video.series} label="Views do vídeo" valueFormat={(value) => `${formatNumber(value)} views`} emptyMessage="A curva de views aparece a partir da segunda coleta deste vídeo." />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Números">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-panel p-3.5">
                  <dt className="text-xs text-ink-2">{stat.label}</dt>
                  <dd className="mt-1 text-xl font-medium text-ink">{stat.value}</dd>
                  {stat.detail ? <dd className="mt-0.5 text-2xs text-ink-3">{stat.detail}</dd> : null}
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Pauta ligada" description="Conecta o planejamento ao resultado">
            {linked ? (
              <div>
                <Link to={`/pautas/${linked.id}`} className="-mx-2 block rounded-lg px-2 py-2 hover:bg-hover">
                  <Badge>{STAGE_LABEL[linked.stage]}</Badge>
                  <p className="mt-1.5 text-sm font-medium text-ink">{linked.title}</p>
                  {linked.promise ? <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{linked.promise}</p> : null}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={Unlink}
                  className="mt-2 -ml-2.5"
                  onClick={() => {
                    mutate((draft) => {
                      const pauta = draft.pautas.find((item) => item.id === linked.id);
                      if (pauta) pauta.videoId = null;
                    });
                    toast('Pauta desligada do vídeo.');
                  }}
                >
                  Desligar
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestion ? (
                  <div className="rounded-lg bg-info-soft p-3">
                    <p className="text-xs text-info">Parece ser a pauta</p>
                    <p className="mt-0.5 text-sm font-medium text-ink">{suggestion.title}</p>
                    <Button size="sm" variant="secondary" icon={Link2} className="mt-2" onClick={() => linkPauta(suggestion.id)}>
                      Ligar esta pauta
                    </Button>
                  </div>
                ) : null}
                {db.pautas.length ? (
                  <Select value="" onChange={(event) => event.target.value && linkPauta(event.target.value)} aria-label="Escolher pauta para ligar">
                    <option value="">Ligar a uma pauta…</option>
                    {db.pautas.filter((pauta) => !pauta.videoId).map((pauta) => (
                      <option key={pauta.id} value={pauta.id}>
                        {pauta.title || 'Sem título'} ({STAGE_LABEL[pauta.stage]})
                      </option>
                    ))}
                  </Select>
                ) : (
                  <p className="text-[13px] text-ink-2">Nenhuma pauta cadastrada.</p>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
