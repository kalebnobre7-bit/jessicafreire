// Banco de dados = arquivos JSON no repositório privado, lidos e gravados pela API do GitHub.
// O token fica só no localStorage deste navegador; o site público não guarda nenhum dado.
export const DATA_REPO = 'kalebnobre7-bit/jessicafreire-data';
const TOKEN_KEY = 'jf-hub:token';

export class GitHubError extends Error {
  constructor(status) {
    super(`GitHub respondeu ${status}`);
    this.status = status;
  }
}

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${DATA_REPO}${path}`, {
    ...options,
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${getToken()}`, 'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  if (!response.ok) throw new GitHubError(response.status);
  return response.status === 204 ? null : response.json();
}

// A API entrega o conteúdo em base64; TextEncoder/Decoder garantem os acentos
function decodeBase64(content) { return new TextDecoder().decode(Uint8Array.from(atob(content.replace(/\n/g, '')), (char) => char.charCodeAt(0))); }
function encodeBase64(text) {
  let binary = '';
  new TextEncoder().encode(text).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export async function readJson(file) {
  const data = await request(`/contents/${file}`);
  return { value: JSON.parse(decodeBase64(data.content)), sha: data.sha };
}

// `sha` é a versão que o painel conhece; se outro aparelho salvou antes, o GitHub responde 409
export async function writeJson(file, value, sha, message) {
  const data = await request(`/contents/${file}`, { method: 'PUT', body: JSON.stringify({ message, content: encodeBase64(`${JSON.stringify(value, null, 2)}\n`), sha }) });
  return data.content.sha;
}

export async function startCollection() {
  await request('/actions/workflows/collect.yml/dispatches', { method: 'POST', body: JSON.stringify({ ref: 'main' }) });
}
