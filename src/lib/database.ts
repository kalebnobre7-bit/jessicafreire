import { CHECKLIST, DEFAULT_SECTIONS } from './constants';
import type { Database, Pauta, Stage } from './types';

export function createId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const EMPTY_DATABASE: Database = {
  version: 2,
  profile: { name: 'Jéssica Freire', handle: '@jessicafreireff' },
  pautas: [],
  references: [],
  channels: [],
  reports: [],
};

export function createPauta(partial: Partial<Pauta> = {}): Pauta {
  const now = Date.now();
  return {
    id: createId(),
    title: '',
    promise: '',
    stage: 'ideia',
    tags: [],
    sections: DEFAULT_SECTIONS.map((section) => ({ id: createId(), label: section.label, body: '' })),
    checklist: CHECKLIST.map(() => false),
    referenceIds: [],
    notes: '',
    recordAt: null,
    publishAt: null,
    videoId: null,
    ignoredVideoIds: [],
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

const LEGACY_STAGE: Record<string, Stage> = { rascunho: 'ideia', roteiro: 'roteiro', publicado: 'publicado' };

// Aceita o db.json da versão anterior do painel (ideas/status) e completa campos que faltarem
export function normalizeDatabase(raw: unknown): Database {
  if (!isRecord(raw)) return structuredClone(EMPTY_DATABASE);
  const profile = isRecord(raw.profile) ? raw.profile : {};
  const legacyIdeas = asArray(raw.ideas);
  const pautaSource = raw.version === 2 ? asArray(raw.pautas) : legacyIdeas;

  const pautas = pautaSource.filter(isRecord).map((item) => {
    const base = createPauta();
    const legacy = raw.version !== 2;
    const stageValue = asString(legacy ? item.status : item.stage);
    const stage = (legacy ? LEGACY_STAGE[stageValue] : (stageValue as Stage)) ?? 'ideia';
    return createPauta({
      ...(legacy ? {} : (item as Partial<Pauta>)),
      id: asString(item.id, base.id),
      title: asString(item.title),
      promise: asString(legacy ? item.note : item.promise),
      stage,
      tags: legacy ? [asString(item.tag)].filter(Boolean) : asArray(item.tags).map((tag) => asString(tag)).filter(Boolean),
      sections: legacy || !Array.isArray(item.sections) ? base.sections : (item.sections as Pauta['sections']),
      checklist: CHECKLIST.map((_, index) => Boolean(asArray(item.checklist)[index])),
      videoId: typeof item.videoId === 'string' ? item.videoId : null,
      ignoredVideoIds: asArray(item.ignoredVideoIds).map((id) => asString(id)),
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : base.updatedAt,
      createdAt: typeof item.createdAt === 'number' ? item.createdAt : typeof item.updatedAt === 'number' ? item.updatedAt : base.createdAt,
    });
  });

  return {
    version: 2,
    profile: { name: asString(profile.name, EMPTY_DATABASE.profile.name), handle: asString(profile.handle, EMPTY_DATABASE.profile.handle) },
    pautas,
    references: asArray(raw.references).filter(isRecord).map((item) => ({
      id: asString(item.id, createId()),
      url: asString(item.url),
      videoId: typeof item.videoId === 'string' && item.videoId ? item.videoId : null,
      title: asString(item.title),
      channel: asString(item.channel),
      note: asString(item.note),
      savedAt: typeof item.savedAt === 'number' ? item.savedAt : Date.now(),
    })),
    channels: asArray(raw.channels).filter(isRecord).map((item) => ({
      id: asString(item.id, createId()),
      name: asString(item.name),
      handle: asString(item.handle),
      note: asString(item.note),
    })),
    reports: asArray(raw.reports).filter(isRecord).map((item) => item as unknown as Database['reports'][number]),
  };
}

// "youtube.com/@Canal", "@canal" ou "canal" → "@canal"; IDs "UC..." ficam como estão
export function normalizeHandle(input: string): string {
  const text = input.trim();
  const fromUrl = text.match(/youtube\.com\/(?:channel\/(UC[\w-]+)|(@[\w.-]+))/i);
  if (fromUrl) return fromUrl[1] ?? (fromUrl[2] ?? '').toLowerCase();
  return text.startsWith('UC') ? text : `@${text.replace(/^@/, '')}`.toLowerCase();
}

export function parseVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('v') || url.match(/(?:youtu\.be\/|\/shorts\/|\/live\/)([\w-]{6,})/)?.[1] || null;
  } catch {
    return null;
  }
}
