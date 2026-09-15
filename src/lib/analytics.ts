// Leituras a partir do metrics.json: desempenho por canal, séries históricas, vídeos em alta, temas e sugestões.
import { formatAge, formatCompact, formatDate, formatScore, dateKey } from './format';
import type { ChannelMetrics, Database, Metrics, ReportSnapshot, Video } from './types';

const DAY = 86_400_000;
const MATURE_DAYS = 3; // vídeo mais novo que isso ainda não acumulou views para comparar
const STOPWORDS = new Set(
  'a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro pros com sem por que se me te eu voce voces ele ela eles elas isso isto esse essa este esta meu minha meus seu sua seus como mais muito ao aos ja so nao sim foi fiz faz vai vou tem ter ser era sao ate agora aqui quem qual quando onde dia dias usando sobre tudo todo toda cada nunca sempre the of to and in on for with you your my is are how what this that'.split(' '),
);
const SHORT_TERMS = new Set(['ia', 'ai']);

export interface Point {
  date: string;
  value: number;
}

export interface AnalyzedVideo extends Video {
  channelHandle: string;
  channelTitle: string;
  ageDays: number;
  score: number | null;
  gained24h: number | null;
  likeRate: number | null;
  series: Point[];
}

export interface AnalyzedChannel extends Omit<ChannelMetrics, 'videos'> {
  videos: AnalyzedVideo[];
  baseline: number;
  uploadEveryDays: number | null;
  daysSinceUpload: number | null;
  top: AnalyzedVideo | null;
  subscribersSeries: Point[];
  totalViewsSeries: Point[];
}

export interface Topic {
  term: string;
  label: string;
  hits: number;
  total: number;
  avgScore: number;
  videoIds: string[];
  covered: boolean;
}

export type InsightAction =
  | { type: 'link-video'; label: string; pautaId: string; videoId: string }
  | { type: 'ignore-match'; label: string; pautaId: string; videoId: string }
  | { type: 'save-reference'; label: string; videoId: string }
  | { type: 'create-pauta'; label: string; topic: string }
  | { type: 'open-pauta'; label: string; pautaId: string }
  | { type: 'open-video'; label: string; videoId: string };

export interface Insight {
  id: string;
  tone: 'up' | 'down' | 'info' | 'accent' | 'neutral';
  title: string;
  text: string;
  actions: InsightAction[];
}

export interface Analysis {
  updatedAt: string;
  channels: Map<string, AnalyzedChannel>;
  profile: AnalyzedChannel | null;
  radar: AnalyzedChannel[];
  videoById: Map<string, AnalyzedVideo>;
  trending: AnalyzedVideo[];
  topics: Topic[];
}

export function toWords(text: string): string[] {
  return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
// Busca por início de palavra, sem acento: "ia" não casa com "ideia", "video" casa com "Vídeos"
export function matchesQuery(text: string, query: string): boolean {
  const haystack = toWords(text);
  return toWords(query).every((token) => haystack.some((word) => word.startsWith(token)));
}
function isContentWord(word: string): boolean {
  return !STOPWORDS.has(word) && !/^\d+$/.test(word) && (word.length >= 3 || SHORT_TERMS.has(word));
}
function contentWords(text: string): string[] {
  return toWords(text).filter(isContentWord);
}
// Mesmas palavras de contentWords, guardando a grafia original (com acento) para exibir
function contentTokens(text: string): { key: string; label: string }[] {
  const labels = text.toLocaleLowerCase('pt-BR').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return toWords(text)
    .map((key, index) => ({ key, label: SHORT_TERMS.has(key) ? key.toUpperCase() : (labels[index] ?? key) }))
    .filter((token) => isContentWord(token.key));
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export function toSeries(record: Record<string, number> | undefined): Point[] {
  return Object.entries(record ?? {})
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
// Último valor conhecido até a data (inclusive)
export function valueAt(series: Point[], date: string): number | null {
  let found: number | null = null;
  for (const point of series) {
    if (point.date > date) break;
    found = point.value;
  }
  return found;
}
// Início de um período: valor no dia ou, se o histórico começou depois, o primeiro valor dentro do período
export function valueFrom(series: Point[], date: string, until: string): number | null {
  return valueAt(series, date) ?? series.find((point) => point.date >= date && point.date <= until)?.value ?? null;
}
// Ganho diário a partir de um contador acumulado (views totais do canal)
export function dailyGains(series: Point[]): Point[] {
  return series.slice(1).map((point, index) => ({ date: point.date, value: Math.max(0, point.value - (series[index]?.value ?? point.value)) }));
}

function analyzeChannel(channel: ChannelMetrics, history: Metrics['history'][string] | undefined, now: number): AnalyzedChannel {
  const yesterday = dateKey(now - DAY);
  const base = channel.videos.map((video) => ({ ...video, ageDays: (now - Date.parse(video.published)) / DAY }));
  const mature = base.filter((video) => video.ageDays >= MATURE_DAYS);
  // Mediana de views do canal: referência para dizer se um vídeo foi bem ou mal
  const baseline = median((mature.length >= 3 ? mature : base).map((video) => video.views));
  const videos: AnalyzedVideo[] = base.map((video) => {
    const series = toSeries(history?.views[video.id]);
    const previous = valueAt(series, yesterday);
    return {
      ...video,
      channelHandle: channel.handle,
      channelTitle: channel.title,
      score: video.ageDays >= MATURE_DAYS && baseline ? video.views / baseline : null,
      gained24h: previous == null || series.at(-1)?.date === yesterday ? null : video.views - previous,
      likeRate: video.views ? video.likes / video.views : null,
      series,
    };
  });
  const gaps = base.slice(0, -1).map((video, index) => (Date.parse(video.published) - Date.parse(base[index + 1]?.published ?? video.published)) / DAY);
  const first = base[0];
  return {
    ...channel,
    videos,
    baseline,
    uploadEveryDays: gaps.length ? median(gaps) : null,
    daysSinceUpload: first ? (now - Date.parse(first.published)) / DAY : null,
    top: videos.filter((video) => video.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null,
    subscribersSeries: toSeries(history?.subscribers),
    totalViewsSeries: toSeries(history?.totalViews),
  };
}

// Temas que se repetem nos vídeos acima da média do radar (palavras e pares de palavras)
function findTopics(videos: AnalyzedVideo[], db: Database): Topic[] {
  const stats = new Map<string, { term: string; label: string; total: number; hits: number; scoreSum: number; videoIds: string[] }>();
  for (const video of videos) {
    if (video.score == null) continue;
    const nameWords = new Set(contentWords(video.channelTitle));
    const tokens = contentTokens(video.title).filter((token) => !nameWords.has(token.key));
    const pairs = tokens.slice(0, -1).map((token, index) => ({ key: `${token.key} ${tokens[index + 1]?.key}`, label: `${token.label} ${tokens[index + 1]?.label}` }));
    const terms = new Map([...tokens, ...pairs].map((token) => [token.key, token.label]));
    for (const [term, label] of terms) {
      const entry = stats.get(term) ?? { term, label, total: 0, hits: 0, scoreSum: 0, videoIds: [] };
      entry.total += 1;
      entry.scoreSum += video.score;
      if (video.score >= 1.2) {
        entry.hits += 1;
        entry.videoIds.push(video.id);
      }
      stats.set(term, entry);
    }
  }
  const ranked = [...stats.values()]
    .filter((entry) => entry.total >= 3 && entry.hits >= 2)
    .map((entry) => ({ ...entry, avgScore: entry.scoreSum / entry.total }))
    // Só entra tema que, na média, performa acima do normal dos canais
    .filter((entry) => entry.avgScore >= 1)
    .sort((a, b) => b.hits * b.avgScore - a.hits * a.avgScore || b.term.split(' ').length - a.term.split(' ').length);
  const chosen: Topic[] = [];
  for (const entry of ranked) {
    // Evita repetir "tiktok" e "shop" quando "tiktok shop" já entrou
    const words = entry.term.split(' ');
    if (chosen.some((item) => item.term.split(' ').includes(entry.term)) || words.every((word) => chosen.some((picked) => picked.term === word))) continue;
    chosen.push({ ...entry, covered: db.pautas.some((pauta) => matchesQuery(`${pauta.title} ${pauta.promise} ${pauta.tags.join(' ')}`, entry.label)) });
    if (chosen.length === 8) break;
  }
  return chosen;
}

// Uma pauta "já publicada" é a que divide pelo menos 60% das palavras (e no mínimo 3) com um vídeo do canal
export function findPublishedMatch(pauta: { title: string; ignoredVideoIds: string[] }, videos: AnalyzedVideo[]): AnalyzedVideo | null {
  const pautaWords = [...new Set(contentWords(pauta.title))];
  if (pautaWords.length < 3) return null;
  let best: { video: AnalyzedVideo; similarity: number } | null = null;
  for (const video of videos) {
    if (pauta.ignoredVideoIds.includes(video.id)) continue;
    const videoWords = new Set(contentWords(video.title));
    const shared = pautaWords.filter((word) => videoWords.has(word)).length;
    const similarity = shared / pautaWords.length;
    if (shared >= 3 && similarity >= 0.6 && (!best || similarity > best.similarity)) best = { video, similarity };
  }
  return best?.video ?? null;
}

export function analyzeMetrics(metrics: Metrics, db: Database, now = Date.now()): Analysis {
  // Nome do canal: o cadastrado no painel tem prioridade sobre o título do YouTube
  const names = new Map(db.channels.map((channel) => [channel.handle.toLowerCase(), channel.name]));
  const channels = new Map(
    Object.entries(metrics.channels).map(([handle, channel]) => [handle, analyzeChannel({ ...channel, title: names.get(handle) ?? channel.title }, metrics.history[handle], now)]),
  );
  const profile = channels.get(db.profile.handle.toLowerCase()) ?? null;
  const radar = db.channels.map((channel) => channels.get(channel.handle.toLowerCase())).filter((channel): channel is AnalyzedChannel => Boolean(channel));
  const radarVideos = radar.flatMap((channel) => channel.videos);
  return {
    updatedAt: metrics.updatedAt,
    channels,
    profile,
    radar,
    videoById: new Map([...channels.values()].flatMap((channel) => channel.videos.map((video) => [video.id, video] as const))),
    trending: radarVideos.filter((video) => video.score != null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    topics: findTopics(radarVideos, db),
  };
}

export function buildInsights(analysis: Analysis, db: Database, now = Date.now()): Insight[] {
  const insights: Insight[] = [];
  const { profile } = analysis;

  if (profile) {
    for (const pauta of db.pautas.filter((item) => item.stage !== 'publicado' && !item.videoId)) {
      const video = findPublishedMatch(pauta, profile.videos);
      if (!video) continue;
      insights.push({
        id: `match-${pauta.id}`,
        tone: 'info',
        title: 'Pauta parece já publicada',
        text: `"${pauta.title}" parece ser o vídeo "${video.title}", publicado ${formatAge(video.published, now)} com ${formatCompact(video.views)} views.`,
        actions: [
          { type: 'link-video', label: 'Marcar como publicada', pautaId: pauta.id, videoId: video.id },
          { type: 'ignore-match', label: 'Não é esse vídeo', pautaId: pauta.id, videoId: video.id },
        ],
      });
    }

    const latestMature = profile.videos.find((video) => video.score != null);
    if (latestMature?.score != null) {
      const above = latestMature.score >= 1;
      insights.push({
        id: `latest-${latestMature.id}`,
        tone: above ? 'up' : 'down',
        title: above ? 'Último vídeo acima da mediana' : 'Último vídeo abaixo da mediana',
        text: `"${latestMature.title}" tem ${formatCompact(latestMature.views)} views, ${formatScore(latestMature.score)} a mediana do canal (${formatCompact(profile.baseline)}).`,
        actions: [{ type: 'open-video', label: 'Ver vídeo', videoId: latestMature.id }],
      });
    }

    const newest = profile.videos[0];
    if (newest && newest.score == null && newest.gained24h != null) {
      insights.push({
        id: `newest-${newest.id}`,
        tone: 'info',
        title: 'Vídeo novo ganhando views',
        text: `"${newest.title}" ganhou ${formatCompact(newest.gained24h)} views desde ontem (${formatCompact(newest.views)} no total).`,
        actions: [{ type: 'open-video', label: 'Ver vídeo', videoId: newest.id }],
      });
    }

    if (profile.uploadEveryDays && profile.daysSinceUpload != null) {
      const days = Math.floor(profile.daysSinceUpload);
      const rhythm = Math.round(profile.uploadEveryDays);
      if (profile.daysSinceUpload > profile.uploadEveryDays * 1.5 && days >= 2) {
        const next = db.pautas.find((pauta) => pauta.stage === 'agendado') ?? db.pautas.find((pauta) => pauta.stage === 'edicao');
        insights.push({
          id: 'rhythm',
          tone: 'down',
          title: 'Ritmo de postagem atrasado',
          text: `O último vídeo saiu há ${days} dias; o ritmo do canal é um vídeo a cada ~${rhythm} dias.`,
          actions: next ? [{ type: 'open-pauta', label: `Abrir "${next.title}"`, pautaId: next.id }] : [],
        });
      }
    }
  }

  const today = dateKey(now);
  for (const pauta of db.pautas) {
    if (pauta.stage !== 'publicado' && pauta.publishAt && pauta.publishAt < today) {
      insights.push({ id: `late-${pauta.id}`, tone: 'down', title: 'Publicação atrasada', text: `"${pauta.title}" estava prevista para ${formatDate(pauta.publishAt)} e ainda está em ${pauta.stage}.`, actions: [{ type: 'open-pauta', label: 'Abrir pauta', pautaId: pauta.id }] });
    }
  }

  const stalled = db.pautas.filter((pauta) => ['roteiro', 'gravacao', 'edicao'].includes(pauta.stage) && now - pauta.updatedAt > 7 * DAY);
  if (stalled.length) {
    const oldest = stalled.sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) insights.push({ id: 'stalled', tone: 'neutral', title: `${stalled.length} ${stalled.length === 1 ? 'pauta parada' : 'pautas paradas'}`, text: `"${oldest.title}" não é mexida ${formatAge(oldest.updatedAt, now)}.`, actions: [{ type: 'open-pauta', label: 'Abrir pauta', pautaId: oldest.id }] });
  }

  for (const video of analysis.trending.filter((item) => (item.score ?? 0) >= 2).slice(0, 2)) {
    const saved = db.references.some((reference) => reference.videoId === video.id);
    insights.push({
      id: `trend-${video.id}`,
      tone: 'accent',
      title: `${video.channelTitle} acima da média`,
      text: `"${video.title}" fez ${formatCompact(video.views)} views, ${formatScore(video.score ?? 0)} a mediana do canal.`,
      actions: saved ? [] : [{ type: 'save-reference', label: 'Salvar referência', videoId: video.id }],
    });
  }

  const gap = analysis.topics.find((topic) => !topic.covered);
  if (gap) {
    insights.push({ id: `topic-${gap.term}`, tone: 'accent', title: 'Tema sem pauta', text: `"${gap.label}" aparece em ${gap.hits} vídeos acima da média do radar e nenhuma pauta fala disso.`, actions: [{ type: 'create-pauta', label: 'Criar pauta', topic: gap.label }] });
  }

  return insights;
}

function inPeriod(published: string, from: string, to: string): boolean {
  const key = dateKey(Date.parse(published));
  return key >= from && key <= to;
}

export function buildSnapshot(analysis: Analysis, from: string, to: string): ReportSnapshot {
  const profile = analysis.profile;
  const videos = (profile?.videos ?? []).filter((video) => inPeriod(video.published, from, to));
  const periodCompetitors = analysis.trending.filter((video) => inPeriod(video.published, from, to));
  return {
    collectedAt: analysis.updatedAt,
    subscribers: { start: profile ? valueFrom(profile.subscribersSeries, from, to) : null, end: profile ? valueAt(profile.subscribersSeries, to) : null },
    views: { start: profile ? valueFrom(profile.totalViewsSeries, from, to) : null, end: profile ? valueAt(profile.totalViewsSeries, to) : null },
    videos: videos.map((video) => ({ id: video.id, title: video.title, published: video.published, views: video.views, likes: video.likes, score: video.score })),
    competitors: (periodCompetitors.length ? periodCompetitors : analysis.trending)
      .filter((video) => (video.score ?? 0) >= 1.2)
      .slice(0, 3)
      .map((video) => ({ id: video.id, title: video.title, channel: video.channelTitle, views: video.views, score: video.score ?? 0 })),
    baseline: profile?.baseline ?? 0,
  };
}
