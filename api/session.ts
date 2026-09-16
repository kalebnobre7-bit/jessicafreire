// POST: entra com a senha. GET: diz se a sessão vale. DELETE: sai.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkPassword, createSession, hasSession, sessionCookie } from './_lib.js';

const WINDOW = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; until: number }>();

function tooManyAttempts(ip: string): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.until < Date.now()) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(ip: string): void {
  const entry = attempts.get(ip);
  const now = Date.now();
  if (!entry || entry.until < now) attempts.set(ip, { count: 1, until: now + WINDOW });
  else entry.count += 1;
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('Cache-Control', 'no-store');

  if (request.method === 'GET') {
    response.status(200).json({ authenticated: hasSession(request) });
    return;
  }

  if (request.method === 'DELETE') {
    response.setHeader('Set-Cookie', sessionCookie(null));
    response.status(200).json({ authenticated: false });
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'método não suportado' });
    return;
  }

  const ip = String(request.headers['x-forwarded-for'] ?? 'desconhecido').split(',')[0]!.trim();
  if (tooManyAttempts(ip)) {
    response.status(429).json({ error: 'muitas tentativas' });
    return;
  }

  const password = (request.body as { password?: unknown } | undefined)?.password;
  if (!checkPassword(password)) {
    registerFailure(ip);
    // Pequena espera para deixar a tentativa em série mais lenta
    await new Promise((resolve) => setTimeout(resolve, 600));
    response.status(401).json({ error: 'senha incorreta' });
    return;
  }

  attempts.delete(ip);
  response.setHeader('Set-Cookie', sessionCookie(createSession()));
  response.status(200).json({ authenticated: true });
}
