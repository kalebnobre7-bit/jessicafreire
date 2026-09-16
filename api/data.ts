// Arquivos de leitura do repositório de dados: metrics.json e ai-ideas.json.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { github, requireSession } from './_lib.js';

const FILES: Record<string, string> = { metrics: 'metrics.json', ideas: 'ai-ideas.json' };

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!requireSession(request, response)) return;
  response.setHeader('Cache-Control', 'no-store');

  const file = FILES[String(request.query.file ?? '')];
  if (!file) {
    response.status(400).json({ error: 'arquivo desconhecido' });
    return;
  }

  const upstream = await github(`/contents/${file}`, {}, 'application/vnd.github.raw+json');
  if (upstream.status === 404) {
    response.status(404).json({ error: 'ainda não existe' });
    return;
  }
  if (!upstream.ok) {
    response.status(upstream.status).json({ error: 'falha ao ler' });
    return;
  }
  response.status(200).send(await upstream.text());
}
