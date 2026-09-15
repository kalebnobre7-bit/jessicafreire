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

// Cada gravação vira um commit na main: duas ao mesmo tempo disputam o topo do branch e uma leva 409.
// A fila faz as gravações deste navegador saírem uma de cada vez.
let writeQueue: Promise<unknown> = Promise.resolve();
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// `sha` é a versão que o painel conhece; se outro aparelho salvou antes, o GitHub responde 409
export async function writeFile(file: string, value: unknown, sha: string | null, message: string): Promise<string> {
  const data = await enqueue(() =>
    request<{ content: { sha: string } }>(`/contents/${file}`, {
      method: 'PUT',
      body: JSON.stringify({ message, content: encodeBase64(`${JSON.stringify(value, null, 2)}\n`), ...(sha ? { sha } : {}) }),
    }),
  );
  return data.content.sha;
}

export async function startCollection(): Promise<void> {
  await startWorkflow('collect.yml');
}

export async function startWorkflow(file: string, inputs?: Record<string, string>): Promise<void> {
  await request(`/actions/workflows/${file}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', ...(inputs ? { inputs } : {}) }) });
}

// Prints da biblioteca: arquivos binários no repositório privado (só leitura com token, então viram blob URL)
export async function writeBinary(path: string, base64: string, message: string): Promise<void> {
  // Arquivo novo: repetir é seguro se o 409 veio de outro commit chegando junto (ex.: coleta do Actions)
  for (let attempt = 0; ; attempt += 1) {
    try {
      await enqueue(() => request(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: base64 }) }));
      return;
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 409) || attempt === 2) throw error;
      await wait(800);
    }
  }
}

export async function readBlob(path: string): Promise<Blob> {
  const response = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`, {
    headers: { Accept: 'application/vnd.github.raw+json', Authorization: `Bearer ${getToken() ?? ''}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok) throw new GitHubError(response.status);
  return response.blob();
}

export async function deleteFile(path: string, message: string): Promise<void> {
  const { sha } = await request<{ sha: string }>(`/contents/${path}`);
  await enqueue(() => request(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message, sha }) }));
}
