// Prints da biblioteca: serve, envia e apaga arquivos em refs/ no repositório privado.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { github, requireSession } from './_lib.js';

const TYPES: Record<string, string> = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif' };

function safePath(value: unknown): string | null {
  const path = String(value ?? '');
  return /^refs\/[\w-]+\.(webp|png|jpg|jpeg|gif)$/.test(path) ? path : null;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (!requireSession(request, response)) return;
  const path = safePath(request.query.path);
  if (!path) {
    response.status(400).json({ error: 'caminho inválido' });
    return;
  }

  if (request.method === 'GET') {
    const upstream = await github(`/contents/${path}`, {}, 'application/vnd.github.raw+json');
    if (!upstream.ok) {
      response.status(upstream.status).json({ error: 'imagem não encontrada' });
      return;
    }
    response.setHeader('Content-Type', TYPES[path.split('.').pop() ?? ''] ?? 'application/octet-stream');
    // Cada print tem nome único, então pode ficar no cache do navegador
    response.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    response.send(Buffer.from(await upstream.arrayBuffer()));
    return;
  }

  if (request.method === 'PUT') {
    const { content, message } = (request.body ?? {}) as { content?: string; message?: string };
    if (!content) {
      response.status(400).json({ error: 'sem conteúdo' });
      return;
    }
    // Arquivo novo: se outro commit chegar junto, o GitHub responde 409 e vale tentar de novo
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const upstream = await github(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message: message ?? 'Adiciona print à biblioteca', content }) });
      if (upstream.ok) {
        response.status(200).json({ path });
        return;
      }
      if (upstream.status !== 409) {
        response.status(upstream.status).json({ error: 'falha ao enviar' });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    response.status(409).json({ error: 'conflito ao enviar' });
    return;
  }

  if (request.method === 'DELETE') {
    const current = await github(`/contents/${path}`);
    if (!current.ok) {
      response.status(current.status).json({ error: 'imagem não encontrada' });
      return;
    }
    const { sha } = (await current.json()) as { sha: string };
    const upstream = await github(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message: 'Remove print da biblioteca', sha }) });
    response.status(upstream.ok ? 200 : upstream.status).json({ ok: upstream.ok });
    return;
  }

  response.status(405).json({ error: 'método não suportado' });
}
