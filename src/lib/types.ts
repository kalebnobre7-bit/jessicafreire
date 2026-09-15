// Formato do banco (db.json) e das métricas (metrics.json) do repositório jessicafreire-data.

export type Stage = 'ideia' | 'roteiro' | 'gravacao' | 'edicao' | 'agendado' | 'publicado';

export interface ScriptSection {
  id: string;
  label: string;
  body: string;
}

export interface Pauta {
  id: string;
  title: string;
  promise: string;
  stage: Stage;
  tags: string[];
  sections: ScriptSection[];
  checklist: boolean[];
  referenceIds: string[];
  notes: string;
  recordAt: string | null;
  publishAt: string | null;
  videoId: string | null;
  ignoredVideoIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Reference {
  id: string;
  url: string;
  videoId: string | null;
  title: string;
  channel: string;
  note: string;
  savedAt: number;
}

export interface Channel {
  id: string;
  name: string;
  handle: string;
  note: string;
}

export interface ReportSnapshot {
  collectedAt: string;
  subscribers: { start: number | null; end: number | null };
  views: { start: number | null; end: number | null };
  videos: { id: string; title: string; published: string; views: number; likes: number; score: number | null }[];
  competitors: { id: string; title: string; channel: string; views: number; score: number }[];
  baseline: number;
}

export interface Report {
  id: string;
  title: string;
  from: string;
  to: string;
  summary: string;
  wins: string;
  recommendations: string[];
  status: 'rascunho' | 'publicado';
  snapshot: ReportSnapshot | null;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

export interface Database {
  version: 2;
  profile: { name: string; handle: string };
  pautas: Pauta[];
  references: Reference[];
  channels: Channel[];
  reports: Report[];
}

export interface Video {
  id: string;
  title: string;
  published: string;
  views: number;
  likes: number;
}

export interface ChannelMetrics {
  handle: string;
  channelId: string | null;
  title: string;
  avatar: string | null;
  subscribers: number | null;
  totalViews: number | null;
  videoCount: number | null;
  videos: Video[];
  collectedAt: string | null;
  error: string | null;
}

export interface ChannelHistory {
  subscribers: Record<string, number>;
  totalViews?: Record<string, number>;
  views: Record<string, Record<string, number>>;
}

export interface Metrics {
  updatedAt: string;
  channels: Record<string, ChannelMetrics>;
  history: Record<string, ChannelHistory>;
}
