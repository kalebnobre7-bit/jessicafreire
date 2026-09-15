import type { ReferenceKind, Stage } from './types';

export const DATA_REPO = 'kalebnobre7-bit/jessicafreire-data';

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'ideia', label: 'Ideia', hint: 'Pautas soltas para avaliar' },
  { id: 'roteiro', label: 'Roteiro', hint: 'Estruturando gancho, prova e CTA' },
  { id: 'gravacao', label: 'Gravação', hint: 'Roteiro fechado, falta gravar' },
  { id: 'edicao', label: 'Edição', hint: 'Gravado, em edição' },
  { id: 'agendado', label: 'Agendado', hint: 'Pronto, com data para sair' },
  { id: 'publicado', label: 'Publicado', hint: 'No ar' },
];

export const STAGE_LABEL = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label])) as Record<Stage, string>;

export const CHECKLIST = [
  'Referência analisada',
  'Gancho definido',
  'Produto ou oferta separado',
  'Thumb com hipótese clara',
  'CTA revisado',
];

export const DEFAULT_SECTIONS = [
  { label: 'Gancho', placeholder: 'Os primeiros 15 segundos: a pergunta ou promessa que prende.' },
  { label: 'Desenvolvimento', placeholder: 'Teste, prova e passo a passo, sem esconder os limites.' },
  { label: 'CTA', placeholder: 'O que a pessoa deve fazer ao final (comentar, clicar, assistir o próximo).' },
];

export const REFERENCE_KINDS: { id: ReferenceKind; label: string; plural: string; hint: string }[] = [
  { id: 'thumb', label: 'Thumb', plural: 'Thumbs', hint: 'Capa que chamou atenção' },
  { id: 'video', label: 'Vídeo', plural: 'Vídeos', hint: 'Vídeo para estudar' },
  { id: 'ideia', label: 'Ideia', plural: 'Ideias', hint: 'Ideia de vídeo solta' },
  { id: 'gancho', label: 'Gancho', plural: 'Ganchos', hint: 'Frase de abertura' },
  { id: 'titulo', label: 'Título', plural: 'Títulos', hint: 'Título para testar' },
  { id: 'formato', label: 'Formato', plural: 'Formatos', hint: 'Estrutura ou estilo de vídeo' },
];

export const REFERENCE_KIND_LABEL = Object.fromEntries(REFERENCE_KINDS.map((kind) => [kind.id, kind.label])) as Record<ReferenceKind, string>;
