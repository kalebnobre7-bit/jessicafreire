// Banco de dados = arquivos JSON no repositório privado, lidos e gravados pela API do GitHub.
// O token fica só no localStorage deste navegador; o site público não guarda nenhum dado.
import { DATA_REPO } from './constants';

const TOKEN_KEY = 'jf:token';
const MODE_KEY = 'jf:mode';
const READER_TOKEN_KEY = 'jf:reader-token';

export type AccessMode = 'editor' | 'leitura';

export class GitHubError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`GitHub respondeu ${status}`);
    this.status = status;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof GitHubError && [401, 403, 404].includes(error.status);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function getMode(): AccessMode {
  return localStorage.getItem(MODE_KEY) === 'leitura' ? 'leitura' : 'editor';
}
export function saveAccess(token: string | null, mode: AccessMode = 'editor'): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(MODE_KEY, mode);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(MODE_KEY);
  }
}

// Token só leitura da Jéssica: guardado neste navegador para gerar o link dos relatórios
export function getReaderToken(): string | null {
  return localStorage.getItem(READER_TOKEN_KEY);
}
export function saveReaderToken(token: string | null): void {
  if (token) localStorage.setItem(READER_TOKEN_KEY, token);
  else localStorage.removeItem(READER_TOKEN_KEY);
}
export function readerLink(): string | null {
  const token = getReaderToken();
  return token ? `${window.location.origin}${window.location.pathname}#/r?acesso=${encodeURIComponent(token)}` : null;
}

async function request<T>(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json', token = getToken()): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${DATA_REPO}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: accept,
      Authorization: `Bearer ${token ?? ''}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!response.ok) throw new GitHubError(response.status);
  if (response.status === 204) return undefined as T;
  return (accept.includes('raw') ? response.text() : response.json()) as Promise<T>;
}

// A API entrega o conteúdo em base64; TextEncoder/Decoder preservam os acentos
function decodeBase64(content: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\n/g, '')), (char) => char.charCodeAt(0)));
}
function encodeBase64(text: string): string {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function readFile(file: string, token?: string): Promise<{ value: unknown; sha: string }> {
  const data = await request<{ content: string; sha: string }>(`/contents/${file}`, {}, undefined, token);
  return { value: JSON.parse(decodeBase64(data.content)), sha: data.sha };
}

// Arquivos grandes (histórico de métricas) passam de 1 MB: o formato raw não tem esse limite
export async function readRawFile(file: string): Promise<unknown> {
  return JSON.parse(await request<string>(`/contents/${file}`, {}, 'application/vnd.github.raw+json'));
}

// `sha` é a versão que o painel conhece; se outro aparelho salvou antes, o GitHub responde 409
export async function writeFile(file: string, value: unknown, sha: string | null, message: string): Promise<string> {
  const data = await request<{ content: { sha: string } }>(`/contents/${file}`, {
    method: 'PUT',
    body: JSON.stringify({ message, content: encodeBase64(`${JSON.stringify(value, null, 2)}\n`), ...(sha ? { sha } : {}) }),
  });
  return data.content.sha;
}

export async function startCollection(): Promise<void> {
  await request('/actions/workflows/collect.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
}
