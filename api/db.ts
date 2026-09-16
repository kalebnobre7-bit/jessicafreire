// Banco do painel: lê e grava o db.json no repositório privado.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { github, requireSession } from './_lib.js';

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!requireSession(request, response)) return;
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET') {
    const upstream = await github('/contents/db.json');
    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'falha ao ler o banco' });
      return;
    }
    const file = (await upstream.json()) as { content: string; sha: string };
    response.status(200).json({ value: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha });
    return;
  }

  if (request.method === 'PUT') {
    const { value, sha, message } = (request.body ?? {}) as { value?: unknown; sha?: string | null; message?: string };
    if (value === undefined) {
      response.status(400).json({ error: 'sem conteúdo' });
      return;
    }
    const upstream = await github('/contents/db.json', {
      method: 'PUT',
      body: JSON.stringify({ message: message ?? 'Atualiza dados pelo painel', content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8').toString('base64'), ...(sha ? { sha } : {}) }),
    });
    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'falha ao gravar' });
      return;
    }
    const saved = (await upstream.json()) as { content: { sha: string } };
    response.status(200).json({ sha: saved.content.sha });
    return;
  }

  response.status(405).json({ error: 'método não suportado' });
}
