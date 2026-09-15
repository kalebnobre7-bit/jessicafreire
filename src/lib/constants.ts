import type { Stage } from './types';

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
