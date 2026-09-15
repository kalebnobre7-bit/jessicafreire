// Leituras automáticas a partir do metrics.json: desempenho por canal, vídeos em alta, temas e sugestões de pauta.
const DAY = 86_400_000;
const MATURE_DAYS = 3; // vídeo mais novo que isso ainda não acumulou views para comparar
const STOPWORDS = new Set('a o as os um uma uns umas de da do das dos e em no na nos nas para pra pro pros com sem por que se me te eu voce voces ele ela eles elas isso isto esse essa este esta meu minha meus seu sua seus como mais muito ao aos ja so nao sim foi fiz faz vai vou tem ter ser era sao ate agora aqui quem qual quando onde dia dias usando sobre tudo todo toda cada nunca sempre the of to and in on for with you your my is are how what this that'.split(' '));
const SHORT_TERMS = new Set(['ia', 'ai']);

export function toWords(text) {
  return String(text).toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}
// Busca por início de palavra, sem acento: "ia" não casa com "ideia", "video" casa com "Vídeos"
export function matchesQuery(text, query) {
  const haystack = toWords(text);
  return toWords(query).every((token) => haystack.some((word) => word.startsWith(token)));
}
function isContentWord(word) { return !STOPWORDS.has(word) && !/^\d+$/.test(word) && (word.length >= 3 || SHORT_TERMS.has(word)); }
function contentWords(text) { return toWords(text).filter(isContentWord); }
// Mesmas palavras de contentWords, mas guardando a grafia original (com acento) pra exibir
function contentTokens(text) {
  const labels = String(text).toLocaleLowerCase('pt-BR').split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return toWords(text).map((key, index) => ({ key, label: SHORT_TERMS.has(key) ? key.toUpperCase() : labels[index] ?? key })).filter((token) => isContentWord(token.key));
}
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function dateKey(ms) { return new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' }); }

export function formatNumber(value) { return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value); }
export function formatScore(score) { return `${score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`; }
export function formatAge(iso, now = Date.now()) {
  const hours = (now - Date.parse(iso)) / 3_600_000;
  const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (hours < 1) return 'agora há pouco';
  if (hours < 24) return relative.format(-Math.round(hours), 'hour');
  const days = Math.round(hours / 24);
  return days < 30 ? relative.format(-days, 'day') : relative.format(-Math.round(days / 30), 'month');
}

function analyzeChannel(channel, history = {}, now) {
  const videos = channel.videos.map((video) => ({ ...video, channelHandle: channel.handle, channelTitle: channel.title, ageDays: (now - Date.parse(video.published)) / DAY }));
  const mature = videos.filter((video) => video.ageDays >= MATURE_DAYS);
  // Mediana de views do canal: referência pra dizer se um vídeo foi bem ou mal
  const baseline = median((mature.length >= 3 ? mature : videos).map((video) => video.views));
  const yesterday = dateKey(now - DAY);
  const scored = videos.map((video) => {
    const previousViews = history.views?.[video.id]?.[yesterday];
    return { ...video, score: video.ageDays >= MATURE_DAYS && baseline ? video.views / baseline : null, gainedSinceYesterday: previousViews == null ? null : video.views - previousViews };
  });
  const gaps = videos.slice(0, -1).map((video, index) => (Date.parse(video.published) - Date.parse(videos[index + 1].published)) / DAY);
  const subscribersWeekAgo = history.subscribers?.[dateKey(now - 7 * DAY)];
  return {
    ...channel,
    videos: scored,
    baseline,
    uploadEveryDays: gaps.length ? median(gaps) : null,
    daysSinceUpload: videos.length ? (now - Date.parse(videos[0].published)) / DAY : null,
    subscribersGrowth: subscribersWeekAgo == null || channel.subscribers == null ? null : channel.subscribers - subscribersWeekAgo,
    top: scored.filter((video) => video.score != null).sort((a, b) => b.score - a.score)[0] ?? null,
  };
}

// Temas que se repetem nos vídeos acima da média do radar (palavras e pares de palavras)
function findTopics(videos) {
  const stats = new Map();
  for (const video of videos.filter((item) => item.score != null)) {
    const nameWords = new Set(contentWords(video.channelTitle));
    const tokens = contentTokens(video.title).filter((token) => !nameWords.has(token.key));
    const pairs = tokens.slice(0, -1).map((token, index) => ({ key: `${token.key} ${tokens[index + 1].key}`, label: `${token.label} ${tokens[index + 1].label}` }));
    const terms = new Map([...tokens, ...pairs].map((token) => [token.key, token.label]));
    for (const [term, label] of terms) {
      const entry = stats.get(term) ?? { term, label, total: 0, hits: 0, scoreSum: 0 };
      entry.total += 1;
      entry.scoreSum += video.score;
      if (video.score >= 1.2) entry.hits += 1;
      stats.set(term, entry);
    }
  }
  const ranked = [...stats.values()].filter((entry) => entry.total >= 3 && entry.hits >= 2).map((entry) => ({ ...entry, avgScore: entry.scoreSum / entry.total })).sort((a, b) => b.hits * b.avgScore - a.hits * a.avgScore || b.term.split(' ').length - a.term.split(' ').length);
  const chosen = [];
  for (const entry of ranked) {
    // Evita repetir "tiktok" e "shop" quando "tiktok shop" já entrou
    if (chosen.some((item) => item.term.split(' ').includes(entry.term) || entry.term.split(' ').every((word) => chosen.some((picked) => picked.term === word)))) continue;
    chosen.push(entry);
    if (chosen.length === 5) break;
  }
  return chosen;
}

// Uma pauta "já publicada" é a que divide pelo menos 60% das palavras (e no mínimo 3) com um vídeo do canal
export function findPublishedMatch(idea, videos) {
  const ideaWords = [...new Set(contentWords(idea.title))];
  if (ideaWords.length < 3) return null;
  let best = null;
  for (const video of videos) {
    if (idea.ignoredVideoIds?.includes(video.id)) continue;
    const videoWords = new Set(contentWords(video.title));
    const shared = ideaWords.filter((word) => videoWords.has(word)).length;
    const similarity = shared / ideaWords.length;
    if (shared >= 3 && similarity >= 0.6 && (!best || similarity > best.similarity)) best = { video, similarity };
  }
  return best?.video ?? null;
}

export function analyzeMetrics(metrics, state, now = Date.now()) {
  const profileHandle = state.profile?.handle?.toLowerCase();
  // Nome do canal: o cadastrado no painel tem prioridade sobre o título do YouTube
  const names = new Map(state.channels.map((channel) => [channel.handle.toLowerCase(), channel.name]));
  const channels = new Map(Object.entries(metrics.channels ?? {}).map(([handle, channel]) => [handle, analyzeChannel({ ...channel, title: names.get(handle) ?? channel.title }, metrics.history?.[handle], now)]));
  const profile = channels.get(profileHandle) ?? null;
  const radar = state.channels.map((channel) => channels.get(channel.handle.toLowerCase())).filter(Boolean);
  const radarVideos = radar.flatMap((channel) => channel.videos);
  const videoById = new Map([...channels.values()].flatMap((channel) => channel.videos.map((video) => [video.id, video])));
  return {
    updatedAt: metrics.updatedAt,
    channels,
    profile,
    videoById,
    trending: radarVideos.filter((video) => video.score != null).sort((a, b) => b.score - a.score),
    topics: findTopics(radarVideos),
  };
}

export function buildInsights(analysis, state) {
  const insights = [];
  const { profile } = analysis;

  if (profile) {
    for (const idea of state.ideas.filter((item) => item.status !== 'publicado' && !item.videoId)) {
      const video = findPublishedMatch(idea, profile.videos);
      if (video) insights.push({ tag: 'JÁ PUBLICADO?', tone: 'blue', text: `A pauta "${idea.title}" parece ser o vídeo "${video.title}", publicado ${formatAge(video.published)} com ${formatNumber(video.views)} views.`, actions: [{ label: 'Marcar como publicado', action: 'link-video', ideaId: idea.id, videoId: video.id }, { label: 'Não é esse', action: 'ignore-match', ideaId: idea.id, videoId: video.id }] });
    }

    const latestMature = profile.videos.find((video) => video.score != null);
    if (latestMature) {
      const above = latestMature.score >= 1;
      insights.push({ tag: above ? 'ACIMA DA MÉDIA' : 'ABAIXO DA MÉDIA', tone: above ? 'green' : 'red', text: `Seu vídeo mais recente com 3+ dias, "${latestMature.title}", tem ${formatNumber(latestMature.views)} views: ${formatScore(latestMature.score)} a sua mediana de ${formatNumber(profile.baseline)}.` });
    }
    const newest = profile.videos[0];
    if (newest && newest.score == null && newest.gainedSinceYesterday != null) {
      insights.push({ tag: 'NOVO VÍDEO', tone: 'blue', text: `"${newest.title}" ganhou ${formatNumber(newest.gainedSinceYesterday)} views desde ontem (${formatNumber(newest.views)} no total).` });
    }
    if (profile.uploadEveryDays && profile.daysSinceUpload != null) {
      const late = profile.daysSinceUpload > profile.uploadEveryDays * 1.5 && profile.daysSinceUpload >= 2;
      const days = Math.floor(profile.daysSinceUpload);
      insights.push({ tag: late ? 'RITMO' : 'RITMO EM DIA', tone: late ? 'red' : 'green', text: late ? `Você não publica há ${days} dias; seu ritmo normal é um vídeo a cada ~${Math.round(profile.uploadEveryDays)} dias.` : `Último vídeo ${days === 0 ? 'hoje' : `há ${days} ${days === 1 ? 'dia' : 'dias'}`}. Seu ritmo é um vídeo a cada ~${Math.round(profile.uploadEveryDays)} dias.` });
    }
  }

  for (const video of analysis.trending.filter((item) => item.score >= 2).slice(0, 2)) {
    const saved = state.references.some((reference) => reference.videoId === video.id);
    insights.push({ tag: 'EM ALTA NO RADAR', tone: 'coral', text: `${video.channelTitle} fez ${formatNumber(video.views)} views com "${video.title}": ${formatScore(video.score)} a mediana do canal.`, actions: saved ? [] : [{ label: 'Salvar como referência', action: 'save-reference', videoId: video.id }] });
  }

  const gap = analysis.topics.find((topic) => !state.ideas.some((idea) => matchesQuery(`${idea.title} ${idea.note}`, topic.term)));
  if (gap) insights.push({ tag: 'OPORTUNIDADE', tone: 'purple', text: `O tema "${gap.label}" está em ${gap.hits} vídeos acima da média do radar e nenhuma pauta sua fala disso.`, actions: [{ label: 'Criar pauta', action: 'create-idea', term: gap.label }] });

  return insights;
}
