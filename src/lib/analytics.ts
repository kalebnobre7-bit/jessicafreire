// Leituras a partir do metrics.json: desempenho por canal, séries históricas, vídeos em alta, temas e sugestões.
import { formatAge, formatCompact, formatDate, formatPercent, formatScore, dateKey, shiftDate } from './format';
import type { ChannelMetrics, Database, Metrics, ReportSnapshot, Video } from './types';

const DAY = 86_400_000;
const MATURE_DAYS = 3; // vídeo mais novo que isso ainda não acumulou views para comparar
const STOPWORDS = new Set(
  'a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro pros com sem por que se me te eu voce voces ele ela eles elas isso isto esse essa este esta meu minha meus seu sua seus como mais muito ao aos ja so nao sim foi fiz faz vai vou tem ter ser era sao ate agora aqui quem qual quando onde dia dias usando sobre tudo todo toda cada nunca sempre the of to and in on for with you your my is are how what this that'.split(' '),
);
const SHORT_TERMS = new Set(['ia', 'ai']);
const RADAR_RELEVANCE_TERMS = new Set([
  'ia', 'ai', 'tiktok', 'shop', 'shopee', 'chatgpt', 'gpt', 'claude', 'gemini', 'video', 'videos',
  'conteudo', 'youtube', 'ugc', 'pov', 'prompt', 'prompts', 'afiliado', 'afiliados', 'afiliada', 'influenciadora', 'influencer',
  'automacao', 'automatico', 'automatica', 'automaticas', 'ferramenta', 'ferramentas', 'canal', 'viral', 'venda', 'vendas', 'vender', 'produto', 'produtos',
  'gratis', 'gratuito', 'gratuita', 'gratuitos', 'gratuitas', 'ilimitado', 'ilimitados', 'ilimitada', 'motion', 'flow', 'veo', 'kling', 'sora', 'higgsfield',
  'agente', 'agentes', 'live', 'lives', 'nicho', 'nichos', 'carrossel', 'roteiro', 'avatar', 'faceless', 'monetizar', 'dropshipping', 'unboxing',
]);
// Palavras comuns em títulos de qualquer nicho: não bastam para dizer que um vídeo fala do assunto da Jéssica
const GENERIC_WORDS = new Set('novo nova novos novas melhor melhores chance contra ganhou fazer criar cria crie testei descobri liberaram liberou achei secreta secreto unica unicas pode copiar mim vez coisa forma jeito passo'.split(' '));
const EARLY_SAMPLES = 3;

export interface Point {
  date: string;
  value: number;
}

export interface AnalyzedVideo extends Video {
  channelHandle: string;
  channelTitle: string;
  ageDays: number;
  // Views contra a mediana do canal no mesmo formato (vídeo longo ou Short), a partir de 3 dias
  score: number | null;
  // Antes de 3 dias: views contra o que os outros vídeos do canal tinham com a mesma idade
  earlyScore: number | null;
  gained24h: number | null;
  // Views ganhas nas últimas 24h em relação à mediana do canal: mostra o que está acelerando agora
  heat: number | null;
  viewsPerDay: number;
  likeRate: number | null;
  // Fala do assunto da Jéssica (lista de termos do nicho ou vocabulário dos títulos dela)
  relevant: boolean;
  series: Point[];
}

export type ChannelPhase = 'alta' | 'estavel' | 'queda';

export interface AnalyzedChannel extends Omit<ChannelMetrics, 'videos'> {
  videos: AnalyzedVideo[];
  baseline: number;
  uploadEveryDays: number | null;
  daysSinceUpload: number | null;
  top: AnalyzedVideo | null;
  subscribersSeries: Point[];
  totalViewsSeries: Point[];
  subscribersGained30d: number | null;
  // Últimos 5 vídeos maduros contra a mediana dos 15: o canal está esquentando ou esfriando
  phase: ChannelPhase | null;
  phaseRatio: number | null;
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
  patterns: TitlePattern[];
  durations: DurationBucket[];
}

export interface TitlePattern {
  id: string;
  label: string;
  example: string;
  // Mediana do "x a mediana" dos vídeos do radar com e sem o padrão
  withScore: number;
  withoutScore: number;
  lift: number;
  count: number;
  total: number;
  videoIds: string[];
  // Parcela dos títulos recentes da Jéssica que usa o padrão, e o mesmo efeito medido no canal dela
  ownShare: number | null;
  ownLift: number | null;
}

export interface DurationBucket {
  id: string;
  label: string;
  radarScore: number | null;
  radarCount: number;
  ownScore: number | null;
  ownCount: number;
}

export function toWords(text: string): string[] {
  return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
export function isRelevantRadarVideo(video: Pick<AnalyzedVideo, 'relevant'>): boolean {
  return video.relevant;
}
// Palavras que aparecem em pelo menos dois títulos da Jéssica: o vocabulário do nicho dela
function ownVocabulary(videos: Video[]): Set<string> {
  const counts = new Map<string, number>();
  for (const video of videos) for (const word of new Set(contentWords(video.title))) counts.set(word, (counts.get(word) ?? 0) + 1);
  return new Set([...counts].filter(([word, count]) => count >= 2 && !GENERIC_WORDS.has(word)).map(([word]) => word));
}
function isRelevantTitle(title: string, vocabulary: Set<string>): boolean {
  const words = toWords(title);
  return words.some((word) => RADAR_RELEVANCE_TERMS.has(word)) || new Set(words.filter((word) => vocabulary.has(word))).size >= 2;
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

function analyzeChannel(channel: ChannelMetrics, history: Metrics['history'][string] | undefined, vocabulary: Set<string>, now: number): AnalyzedChannel {
  const today = dateKey(now);
  const yesterday = dateKey(now - DAY);
  const base = channel.videos.map((video) => ({ ...video, ageDays: (now - Date.parse(video.published)) / DAY, series: toSeries(history?.views[video.id]) }));
  // A referência fica nos últimos 15 vídeos longos para não distorcer a leitura atual com o catálogo antigo nem com Shorts
  const baselineOf = (videos: typeof base) => {
    const recent = videos.slice(0, 15);
    const mature = recent.filter((video) => video.ageDays >= MATURE_DAYS);
    return { recent, mature, value: median((mature.length >= 3 ? mature : recent).map((video) => video.views)) };
  };
  const long = baselineOf(base.filter((video) => !video.short));
  const shorts = baselineOf(base.filter((video) => video.short));
  const baseline = long.value;
  // Quantas views os vídeos do canal tinham com N dias de vida, lido no histórico diário
  const viewsAtAge = (days: number, except: string, short: boolean) =>
    base
      .filter((video) => video.id !== except && Boolean(video.short) === short && video.ageDays >= MATURE_DAYS)
      .map((video) => valueAt(video.series, shiftDate(dateKey(Date.parse(video.published)), days)))
      .filter((value): value is number => value != null && value > 0);

  const videos: AnalyzedVideo[] = base.map((video) => {
    const reference = video.short ? (shorts.mature.length >= 3 ? shorts.value : 0) : baseline;
    // Ganho no último dia coletado, desde que a coleta seja de hoje ou de ontem (de madrugada a de hoje ainda não rodou)
    const last = video.series.at(-1);
    const previous = last && last.date >= yesterday ? valueAt(video.series, shiftDate(last.date, -1)) : null;
    const gained24h = previous == null ? null : Math.max(0, video.views - previous);
    let earlyScore: number | null = null;
    // Com menos de 12h o vídeo seria comparado ao dia inteiro dos outros
    if (video.ageDays < MATURE_DAYS && video.ageDays >= 0.5) {
      const days = Math.max(0, Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${dateKey(Date.parse(video.published))}T12:00:00`)) / DAY));
      const samples = viewsAtAge(days, video.id, Boolean(video.short));
      if (samples.length >= EARLY_SAMPLES) earlyScore = video.views / median(samples);
    }
    return {
      ...video,
      channelHandle: channel.handle,
      channelTitle: channel.title,
      score: video.ageDays >= MATURE_DAYS && reference ? video.views / reference : null,
      earlyScore,
      gained24h,
      heat: gained24h != null && reference ? gained24h / reference : null,
      viewsPerDay: video.views / Math.max(video.ageDays, 0.25),
      likeRate: video.views ? video.likes / video.views : null,
      relevant: isRelevantTitle(video.title, vocabulary),
    };
  });
  const recent = long.recent;
  const gaps = recent.slice(0, -1).map((video, index) => (Date.parse(video.published) - Date.parse(recent[index + 1]?.published ?? video.published)) / DAY);
  const first = base[0];
  const subscribersSeries = toSeries(history?.subscribers);
  const pastSubscribers = valueFrom(subscribersSeries, shiftDate(today, -30), today);
  const currentSubscribers = valueAt(subscribersSeries, today);
  const lastFive = long.mature.slice(0, 5);
  const phaseRatio = lastFive.length >= 3 && long.mature.length >= 8 && baseline ? median(lastFive.map((video) => video.views)) / baseline : null;
  return {
    ...channel,
    videos,
    baseline,
    uploadEveryDays: gaps.length ? median(gaps) : null,
    daysSinceUpload: first ? (now - Date.parse(first.published)) / DAY : null,
    top: videos.filter((video) => video.score != null && !video.short).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0] ?? null,
    subscribersSeries,
    totalViewsSeries: toSeries(history?.totalViews),
    subscribersGained30d: pastSubscribers == null || currentSubscribers == null || subscribersSeries.length < 2 ? null : currentSubscribers - pastSubscribers,
    phase: phaseRatio == null ? null : phaseRatio >= 1.25 ? 'alta' : phaseRatio <= 0.8 ? 'queda' : 'estavel',
    phaseRatio,
  };
}

// Temas que se repetem nos vídeos acima da média do radar (palavras e pares de palavras)
export function findTopics(videos: AnalyzedVideo[], db: Database, { minTotal = 3, minHits = 2, limit = 8 } = {}): Topic[] {
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
    .filter((entry) => entry.total >= minTotal && entry.hits >= minHits)
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
    if (chosen.length === limit) break;
  }
  return chosen;
}

const TITLE_PATTERNS: { id: string; label: string; example: string; test: (title: string, words: string[]) => boolean }[] = [
  { id: 'numero', label: 'Número no título', example: '5 IAs, 7 dias, 10 vídeos', test: (title) => /\d/.test(title.replace(/\b(19|20)\d{2}\b/g, '')) },
  { id: 'dinheiro', label: 'Valor em dinheiro', example: 'R$4.400, 100 mil', test: (title) => /R\$|US\$|£|€|\d\s*mil\b/i.test(title) },
  { id: 'gratis', label: 'Promessa de grátis', example: 'de graça, 100% gratuito', test: (title, words) => words.some((word) => /^(gratis|gratuit|free)/.test(word)) || /de gra[cç]a|sem pagar/i.test(title) },
  { id: 'experiencia', label: 'Experiência própria', example: 'testei, fiz, criei, copiei', test: (_, words) => words.some((word) => ['testei', 'fiz', 'criei', 'copiei', 'montei', 'usei', 'deixei', 'coloquei', 'faturei', 'ganhei', 'vendi'].includes(word)) },
  { id: 'novidade', label: 'Novidade', example: 'nova IA, lançou, liberaram', test: (_, words) => words.some((word) => ['nova', 'novo', 'lancou', 'lancaram', 'liberou', 'liberaram', 'chegou', 'finalmente', 'acaba'].includes(word)) },
  { id: 'segredo', label: 'Segredo ou descoberta', example: 'secreta, escondida, ninguém conhece', test: (_, words) => words.some((word) => /^(secret|escondid|descobri|ninguem|revelad|truque)/.test(word)) },
  { id: 'prazo', label: 'Prazo ou desafio', example: 'em 7 dias, em 24 horas', test: (title) => /\d+\s*(dias|horas|h\b|minutos|min\b|semanas)/i.test(title) },
  { id: 'parenteses', label: 'Complemento entre parênteses', example: '(PODE ME COPIAR)', test: (title) => /\([^)]{3,}\)/.test(title) },
  { id: 'pergunta', label: 'Pergunta', example: 'vale a pena?', test: (title) => title.includes('?') },
  { id: 'caixa-alta', label: 'Título todo em caixa alta', example: 'NUNCA MAIS PAGUE…', test: (title) => {
    const letters = title.replace(/[^\p{L}]/gu, '');
    return letters.length >= 10 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length >= 0.7;
  } },
  { id: 'emoji', label: 'Emoji', example: '🔥 🤯', test: (title) => /\p{Extended_Pictographic}/u.test(title) },
];

// Quais estruturas de título andam junto com desempenho acima da mediana no radar, e quanto a Jéssica já usa cada uma
export function findTitlePatterns(radar: AnalyzedVideo[], own: AnalyzedVideo[]): TitlePattern[] {
  const scored = radar.filter((video) => video.score != null && !video.short);
  const ownScored = own.filter((video) => video.score != null && !video.short);
  const ownRecent = own.filter((video) => !video.short).slice(0, 15);
  const measure = (videos: AnalyzedVideo[], test: (title: string, words: string[]) => boolean) => {
    const withPattern = videos.filter((video) => test(video.title, toWords(video.title)));
    const without = videos.filter((video) => !withPattern.includes(video));
    return { withPattern, without, withScore: median(withPattern.map((video) => video.score ?? 0)), withoutScore: median(without.map((video) => video.score ?? 0)) };
  };
  return TITLE_PATTERNS.flatMap((pattern) => {
    const radarStats = measure(scored, pattern.test);
    if (radarStats.withPattern.length < 5 || radarStats.without.length < 5 || !radarStats.withoutScore) return [];
    const ownStats = measure(ownScored, pattern.test);
    return [{
      id: pattern.id,
      label: pattern.label,
      example: pattern.example,
      withScore: radarStats.withScore,
      withoutScore: radarStats.withoutScore,
      lift: radarStats.withScore / radarStats.withoutScore,
      count: radarStats.withPattern.length,
      total: scored.length,
      videoIds: [...radarStats.withPattern].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 4).map((video) => video.id),
      ownShare: ownRecent.length ? ownRecent.filter((video) => pattern.test(video.title, toWords(video.title))).length / ownRecent.length : null,
      ownLift: ownStats.withPattern.length >= 3 && ownStats.without.length >= 3 && ownStats.withoutScore ? ownStats.withScore / ownStats.withoutScore : null,
    }];
  }).sort((a, b) => b.lift - a.lift);
}

const DURATION_BUCKETS = [
  { id: 'curto', label: 'Até 8 min', max: 8 * 60 },
  { id: 'medio', label: '8 a 15 min', max: 15 * 60 },
  { id: 'longo', label: 'Mais de 15 min', max: Infinity },
];

export function findDurationBuckets(radar: AnalyzedVideo[], own: AnalyzedVideo[]): DurationBucket[] {
  const bucketOf = (video: AnalyzedVideo) => DURATION_BUCKETS.find((bucket) => (video.duration ?? 0) <= bucket.max)?.id;
  const timed = (videos: AnalyzedVideo[]) => videos.filter((video) => video.score != null && !video.short && video.duration);
  const radarTimed = timed(radar);
  if (radarTimed.length < 6) return [];
  const ownTimed = timed(own);
  return DURATION_BUCKETS.map((bucket) => {
    const radarIn = radarTimed.filter((video) => bucketOf(video) === bucket.id);
    const ownIn = ownTimed.filter((video) => bucketOf(video) === bucket.id);
    return {
      id: bucket.id,
      label: bucket.label,
      radarScore: radarIn.length >= 2 ? median(radarIn.map((video) => video.score ?? 0)) : null,
      radarCount: radarIn.length,
      ownScore: ownIn.length >= 2 ? median(ownIn.map((video) => video.score ?? 0)) : null,
      ownCount: ownIn.length,
    };
  });
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
  const vocabulary = ownVocabulary(metrics.channels[db.profile.handle.toLowerCase()]?.videos ?? []);
  const channels = new Map(
    Object.entries(metrics.channels).map(([handle, channel]) => [handle, analyzeChannel({ ...channel, title: names.get(handle) ?? channel.title }, metrics.history[handle], vocabulary, now)]),
  );
  const profile = channels.get(db.profile.handle.toLowerCase()) ?? null;
  const radar = db.channels.map((channel) => channels.get(channel.handle.toLowerCase())).filter((channel): channel is AnalyzedChannel => Boolean(channel));
  const radarVideos = radar.flatMap((channel) => channel.videos);
  const relevantRadarVideos = radarVideos.filter(isRelevantRadarVideo);
  return {
    updatedAt: metrics.updatedAt,
    channels,
    profile,
    radar,
    videoById: new Map([...channels.values()].flatMap((channel) => channel.videos.map((video) => [video.id, video] as const))),
    trending: radarVideos.filter((video) => video.score != null && !video.short).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    topics: findTopics(relevantRadarVideos.filter((video) => !video.short), db),
    patterns: findTitlePatterns(relevantRadarVideos, profile?.videos ?? []),
    durations: findDurationBuckets(relevantRadarVideos, profile?.videos ?? []),
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

    const newest = profile.videos.find((video) => !video.short);
    if (newest && newest.score == null && newest.earlyScore != null) {
      const above = newest.earlyScore >= 1;
      insights.push({
        id: `newest-${newest.id}`,
        tone: above ? 'up' : 'down',
        title: above ? 'Vídeo novo largando acima do normal' : 'Vídeo novo largando abaixo do normal',
        text: `"${newest.title}" saiu ${formatAge(newest.published, now)} e tem ${formatCompact(newest.views)} views, ${formatScore(newest.earlyScore)} o que os vídeos do canal costumam ter com a mesma idade.`,
        actions: [{ type: 'open-video', label: 'Ver vídeo', videoId: newest.id }],
      });
    } else if (newest && newest.score == null && newest.gained24h != null) {
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

  const radarVideos = analysis.radar.flatMap((channel) => channel.videos).filter((video) => video.relevant && !video.short);
  const breakout = radarVideos.filter((video) => (video.earlyScore ?? 0) >= 2).sort((a, b) => (b.earlyScore ?? 0) - (a.earlyScore ?? 0))[0];
  if (breakout?.earlyScore != null) {
    const saved = db.references.some((reference) => reference.videoId === breakout.id);
    insights.push({
      id: `early-${breakout.id}`,
      tone: 'accent',
      title: `${breakout.channelTitle} decolando agora`,
      text: `"${breakout.title}" saiu ${formatAge(breakout.published, now)} e já tem ${formatCompact(breakout.views)} views, ${formatScore(breakout.earlyScore)} o normal do canal para a mesma idade.`,
      actions: saved ? [] : [{ type: 'save-reference', label: 'Salvar referência', videoId: breakout.id }],
    });
  }
  // Vídeo já maduro que voltou a ganhar muitas views: o algoritmo está empurrando de novo
  const resurging = radarVideos.filter((video) => video.score != null && (video.heat ?? 0) >= 0.3).sort((a, b) => (b.heat ?? 0) - (a.heat ?? 0))[0];
  if (resurging?.heat != null && resurging.gained24h != null) {
    const saved = db.references.some((reference) => reference.videoId === resurging.id);
    insights.push({
      id: `heat-${resurging.id}`,
      tone: 'accent',
      title: `${resurging.channelTitle} ganhando views de novo`,
      text: `"${resurging.title}" ganhou ${formatCompact(resurging.gained24h)} views nas últimas 24h, o equivalente a ${formatPercent(resurging.heat, 0)} das views de um vídeo típico do canal em um só dia.`,
      actions: saved ? [] : [{ type: 'save-reference', label: 'Salvar referência', videoId: resurging.id }],
    });
  }

  for (const video of analysis.trending.filter((item) => (item.score ?? 0) >= 2 && isRelevantRadarVideo(item)).slice(0, 2)) {
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
