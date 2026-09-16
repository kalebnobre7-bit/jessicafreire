// Tudo passa pelo servidor do painel (/api): o token do GitHub fica lá, nunca no navegador.
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`API respondeu ${status}`);
    this.status = status;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && [401, 403].includes(error.status);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export async function checkSession(): Promise<boolean> {
  try {
    return (await request<{ authenticated: boolean }>('/session')).authenticated;
  } catch {
    return false;
  }
}

export type LoginResult = 'ok' | 'senha' | 'limite' | 'erro';

export async function login(password: string): Promise<LoginResult> {
  try {
    await request('/session', { method: 'POST', body: JSON.stringify({ password }) });
    return 'ok';
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return 'senha';
    if (error instanceof ApiError && error.status === 429) return 'limite';
    return 'erro';
  }
}

export async function logout(): Promise<void> {
  await request('/session', { method: 'DELETE' }).catch(() => undefined);
}

export async function readDb(): Promise<{ value: unknown; sha: string }> {
  return request('/db');
}

export async function writeDb(value: unknown, sha: string | null, message: string): Promise<string> {
  return (await request<{ sha: string }>('/db', { method: 'PUT', body: JSON.stringify({ value, sha, message }) })).sha;
}

export async function readDataFile<T>(file: 'metrics' | 'ideas'): Promise<T> {
  return request<T>(`/data?file=${file}`);
}

export async function uploadImage(path: string, base64: string): Promise<void> {
  await request(`/file?path=${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify({ content: base64 }) });
}

export async function deleteImage(path: string): Promise<void> {
  await request(`/file?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
}

// A imagem é servida pelo próprio painel, então dá para usar direto no <img>
export function imageUrl(path: string): string {
  return `/api/file?path=${encodeURIComponent(path)}`;
}

export async function startWorkflow(workflow: 'collect.yml' | 'recommend.yml', inputs?: Record<string, string>): Promise<void> {
  await request('/dispatch', { method: 'POST', body: JSON.stringify({ workflow, inputs }) });
}

export async function startCollection(): Promise<void> {
  await startWorkflow('collect.yml');
}
