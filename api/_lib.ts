// Sessão assinada em cookie e acesso ao repositório de dados. O token do GitHub vive só aqui no servidor.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const COOKIE = 'jf_session';
const MAX_AGE = 60 * 60 * 24 * 180; // 180 dias
export const DATA_REPO = process.env.DATA_REPO ?? 'kalebnobre7-bit/jessicafreire-data';

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET não configurado');
  return value;
}

function sign(payload: string): string {
  return `${payload}.${createHmac('sha256', secret()).update(payload).digest('base64url')}`;
}

function equals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSession(): string {
  return sign(String(Date.now()));
}

export function sessionCookie(value: string | null): string {
  const base = `${COOKIE}=${value ?? ''}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  return value ? `${base}; Max-Age=${MAX_AGE}` : `${base}; Max-Age=0`;
}

export function hasSession(request: VercelRequest): boolean {
  const value = request.cookies?.[COOKIE];
  const [payload, signature] = value?.split('.') ?? [];
  if (!payload || !signature) return false;
  return equals(`${payload}.${signature}`, sign(payload));
}

export function checkPassword(password: unknown): boolean {
  const expected = process.env.APP_PASSWORD;
  return typeof password === 'string' && Boolean(expected) && equals(password.trim().toLowerCase(), expected!.trim().toLowerCase());
}

export function requireSession(request: VercelRequest, response: VercelResponse): boolean {
  if (hasSession(request)) return true;
  response.status(401).json({ error: 'não autenticado' });
  return false;
}

// Chamada à API do GitHub com o token do servidor
export async function github(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json'): Promise<Response> {
  return fetch(`https://api.github.com/repos/${DATA_REPO}${path}`, {
    ...init,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${process.env.GITHUB_TOKEN ?? ''}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'jf-studio',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
}
