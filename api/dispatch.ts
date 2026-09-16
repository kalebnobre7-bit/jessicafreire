// Dispara os workflows do repositório de dados: coleta de métricas e geração de ideias.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { github, requireSession } from './_lib.js';

const WORKFLOWS = new Set(['collect.yml', 'recommend.yml']);

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!requireSession(request, response)) return;
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'método não suportado' });
    return;
  }

  const { workflow, inputs } = (request.body ?? {}) as { workflow?: string; inputs?: Record<string, string> };
  if (!workflow || !WORKFLOWS.has(workflow)) {
    response.status(400).json({ error: 'workflow desconhecido' });
    return;
  }

  const upstream = await github(`/actions/workflows/${workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }) });
  response.status(upstream.ok ? 200 : upstream.status).json({ ok: upstream.ok });
}
