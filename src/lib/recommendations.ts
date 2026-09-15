// Sugestões de vídeos para gravar calculadas a partir dos dados (sem IA): radar, canal, pautas e biblioteca.
import { findTopics, type Analysis } from './analytics';
import { formatAge, formatCompact, formatScore } from './format';
import type { Database, Pauta } from './types';

const DAY = 86_400_000;
const LIBRARY_STALE_DAYS = 5;
const KNOWN_TERMS: Record<string, string> = { ia: 'IA', tiktok: 'TikTok', chatgpt: 'ChatGPT', youtube: 'YouTube', shopee: 'Shopee', instagram: 'Instagram', google: 'Google', pov: 'POV', ugc: 'UGC' };

export type RecommendationKind = 'ritmo' | 'adaptar' | 'repetir' | 'seu-tema' | 'tema' | 'biblioteca';

export interface Recommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  reason: string;
  videoIds: string[];
  referenceId: string | null;
  priority: number;
  pauta: Partial<Pauta> | null;
}

export const RECOMMENDATION_LABEL: Record<RecommendationKind, string> = {
  ritmo: 'Ritmo',
  adaptar: 'Adaptar do radar',
  repetir: 'Repetir o que funcionou',
  'seu-tema': 'Tema forte no seu canal',
  tema: 'Tema em alta sem pauta',
  biblioteca: 'Ideia parada na biblioteca',
};

// Títulos do nicho vêm em CAIXA ALTA; para virar pauta, frase normal com os nomes próprios certos
export function toSentenceCase(title: string): string {
  const letters = title.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  if (!letters || upper / letters.length < 0.6) return title;
  const lower = title.toLocaleLowerCase('pt-BR').replace(/\p{L}+/gu, (word) => KNOWN_TERMS[word] ?? word).replace(/\br\$/g, 'R$');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

export function buildRecommendations(analysis: Analysis | null, db: Database, now = Date.now()): Recommendation[] {
  const list: Recommendation[] = [];
  const referencedVideoIds = new Set(db.pautas.flatMap((pauta) => pauta.referenceIds).map((id) => db.references.find((reference) => reference.id === id)?.videoId).filter(Boolean));
  const profile = analysis?.profile;

  if (profile?.uploadEveryDays && profile.daysSinceUpload != null) {
    const ready = db.pautas.some((pauta) => pauta.stage === 'edicao' || pauta.stage === 'agendado');
    if (!ready && profile.daysSinceUpload >= profile.uploadEveryDays * 0.8) {
      list.push({
        id: `ritmo-${new Date(now).toISOString().slice(0, 10)}`,
        kind: 'ritmo',
        title: 'Nada pronto para o próximo vídeo',
        reason: `O último vídeo saiu há ${Math.floor(profile.daysSinceUpload)} ${Math.floor(profile.daysSinceUpload) === 1 ? 'dia' : 'dias'}, o ritmo do canal é a cada ~${Math.round(profile.uploadEveryDays)} dias e nenhuma pauta está em edição ou agendada.`,
        videoIds: [],
        referenceId: null,
        priority: 100,
        pauta: null,
      });
    }
  }

  for (const video of (analysis?.trending ?? []).filter((item) => (item.score ?? 0) >= 1.5 && !referencedVideoIds.has(item.id)).slice(0, 5)) {
    const score = video.score ?? 0;
    list.push({
      id: `adaptar-${video.id}`,
      kind: 'adaptar',
      title: `Sua versão de "${toSentenceCase(video.title)}"`,
      reason: `${video.channelTitle} fez ${formatCompact(video.views)} views ${formatAge(video.published, now)}, ${formatScore(score)} a mediana do próprio canal. Teste o mesmo tema no seu formato.`,
      videoIds: [video.id],
      referenceId: null,
      priority: 70 + Math.min(score, 5) * 4,
      pauta: { title: toSentenceCase(video.title), notes: `Adaptado de ${video.channelTitle} (${formatScore(score)} a mediana): https://www.youtube.com/watch?v=${video.id}` },
    });
  }

  for (const video of (profile?.videos ?? []).filter((item) => (item.score ?? 0) >= 1.8).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 3)) {
    const score = video.score ?? 0;
    list.push({
      id: `repetir-${video.id}`,
      kind: 'repetir',
      title: `Parte 2 de "${toSentenceCase(video.title)}"`,
      reason: `Esse vídeo fez ${formatCompact(video.views)} views, ${formatScore(score)} a sua mediana. Uma continuação ou nova versão aproveita a demanda que já existe.`,
      videoIds: [video.id],
      referenceId: null,
      priority: 65 + Math.min(score, 8) * 3,
      pauta: { title: `Parte 2: ${toSentenceCase(video.title)}`, notes: `Continuação do vídeo que fez ${formatScore(score)} a mediana: https://www.youtube.com/watch?v=${video.id}` },
    });
  }

  if (profile && analysis) {
    for (const topic of findTopics(profile.videos, db, { minTotal: 2, minHits: 2, limit: 5 }).filter((item) => item.avgScore >= 1.2).slice(0, 3)) {
      list.push({
        id: `seu-tema-${topic.term}`,
        kind: 'seu-tema',
        title: `Mais um vídeo sobre ${topic.label}`,
        reason: `Seus vídeos com "${topic.label}" fazem em média ${formatScore(topic.avgScore)} a mediana (${topic.hits} de ${topic.total} acima da média).`,
        videoIds: topic.videoIds.slice(0, 3),
        referenceId: null,
        priority: 60 + Math.min(topic.avgScore, 4) * 5,
        pauta: { title: `Vídeo sobre ${topic.label}`, tags: [topic.label] },
      });
    }
  }

  for (const topic of (analysis?.topics ?? []).filter((item) => !item.covered).slice(0, 3)) {
    list.push({
      id: `tema-${topic.term}`,
      kind: 'tema',
      title: `Vídeo sobre ${topic.label}`,
      reason: `"${topic.label}" aparece em ${topic.hits} vídeos acima da média dos canais do radar e nenhuma pauta fala disso.`,
      videoIds: topic.videoIds.slice(0, 3),
      referenceId: null,
      priority: 50 + topic.hits * 2,
      pauta: { title: `Vídeo sobre ${topic.label}`, tags: [topic.label], notes: `Tema em alta no radar: ${topic.label}` },
    });
  }

  const usedReferences = new Set(db.pautas.flatMap((pauta) => pauta.referenceIds));
  for (const reference of db.references.filter((item) => ['ideia', 'titulo', 'gancho', 'formato'].includes(item.kind) && !usedReferences.has(item.id) && now - item.savedAt > LIBRARY_STALE_DAYS * DAY).slice(0, 4)) {
    list.push({
      id: `biblioteca-${reference.id}`,
      kind: 'biblioteca',
      title: reference.title,
      reason: `Salva na biblioteca ${formatAge(reference.savedAt, now)} e ainda sem pauta.`,
      videoIds: reference.videoId ? [reference.videoId] : [],
      referenceId: reference.id,
      priority: 40,
      pauta: { title: reference.title, notes: reference.note, tags: reference.tags, referenceIds: [reference.id] },
    });
  }

  const dismissed = new Set(db.dismissed);
  return list.filter((item) => !dismissed.has(item.id)).sort((a, b) => b.priority - a.priority);
}
