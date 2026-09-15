// Entrada por senha: a senha destrava o token do GitHub guardado criptografado em src/access.json.
// Gerado por scripts/set-password.ts (PBKDF2 SHA-256 + AES-GCM).
import access from '@/access.json';

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export async function unlockToken(password: string): Promise<string | null> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromBase64(access.salt), iterations: access.iterations, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try {
    const token = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(access.iv) }, key, fromBase64(access.data));
    return new TextDecoder().decode(token);
  } catch {
    // AES-GCM falha na verificação quando a senha está errada
    return null;
  }
}
