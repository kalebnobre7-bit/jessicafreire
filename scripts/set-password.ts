// Gera src/access.json: o token do GitHub criptografado com a senha de acesso do painel.
// Uso: npm run senha  (pede o token e a senha; Enter na senha gera uma de palavras)
// O arquivo vai para o site público, então a segurança depende da senha: nada de senha curta.
import { randomInt, webcrypto } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';

const ITERATIONS = 600_000;
const MIN_LENGTH = 16;
const WORDS = (
  'abacate abelha abraco acucar agua alegria alface amarelo amigo anel anjo antena apito aranha arco areia arroz arte astro atleta aviao azeite azul ' +
  'bala balde baleia banana banco bandeira barco barro batata bebida beijo bicho bola bolo bolsa bombom borboleta bota braco branco brilho brinco broa bule burro ' +
  'cabelo cabra cacau cafe caju calor cama camelo caminho campo caneca caneta canoa cantor capim carro carta casa castelo cavalo cebola cedro cenoura cereja chave chuva cidade cinema circo cobra coco coelho colher cometa copo coracao coruja corrida costa couve cravo cristal cubo ' +
  'dado dente deserto doce domingo dragao duende elefante espelho estrela faca fada farol feijao feira festa figo flauta flor floresta fogo folha fonte formiga forno foto fruta fumaca ' +
  'gaita galho galo garfo gato gelo girafa globo goiaba golfinho gota grama gravata guitarra harpa hora horta ilha iogurte janela jardim jarra jogo joia laco lago lagoa lampada lanche lapis laranja leao leite lenco limao linha livro lobo lua luva ' +
  'maca macaco madeira manga mapa mar marte massa mel melancia mesa milho moeda montanha morango mosca musica navio neve ninho noite nuvem oceano onda ouro ovelha ' +
  'padaria palco palha panela papel parque pato pedra peixe pena pera piano pipa pipoca pirata planeta pluma poeira polvo ponte porta praia prato queijo ' +
  'raio rato rede relogio remo rio robo roda rosa sabao samba sapato sapo selva sereia sino sol sopa tambor tapete tatu teatro telhado tigre tijolo tinta tomate torre trem trigo trilha trovao tucano ' +
  'uva vaca vela veleiro vento verde vila violao vulcao xadrez zebra'
).split(' ');

const encoder = new TextEncoder();
const toBase64 = (bytes: ArrayBuffer | Uint8Array) => Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64');

async function ask(question: string): Promise<string> {
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await reader.question(question);
  reader.close();
  return answer.trim();
}

const token = process.env.TOKEN_FILE ? (await readFile(process.env.TOKEN_FILE, 'utf8')).trim() : await ask('Token do GitHub (fine-grained, só no jessicafreire-data): ');
let password = process.env.PASSWORD ?? (await ask('Senha nova (Enter para gerar uma): '));
const generated = !password;
if (generated) password = `${Array.from({ length: 4 }, () => WORDS[randomInt(WORDS.length)]).join('-')}-${randomInt(100, 1000)}`;
// Mesma normalização da tela de entrada: minúsculas e espaços viram hífens
password = password.trim().toLowerCase().replace(/\s+/g, '-');
if (password.length < MIN_LENGTH) throw new Error(`A senha precisa de pelo menos ${MIN_LENGTH} caracteres.`);
if (!token.startsWith('github_pat_')) throw new Error('Use um token fine-grained (começa com github_pat_).');

const salt = webcrypto.getRandomValues(new Uint8Array(16));
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const baseKey = await webcrypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
const key = await webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
const data = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(token));

await writeFile('src/access.json', `${JSON.stringify({ version: 1, iterations: ITERATIONS, salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data) }, null, 2)}\n`);
console.log('src/access.json atualizado. Faça commit e push para publicar.');
console.log(generated ? `Senha gerada: ${password}` : `Senha salva: ${password}`);
