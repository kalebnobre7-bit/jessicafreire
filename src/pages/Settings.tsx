import { Check, Copy, ExternalLink, KeyRound, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/feedback';
import { Field, Input, SegmentedControl } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/overlay';
import { DATA_REPO } from '@/lib/constants';
import { formatAge, formatDate } from '@/lib/format';
import { getReaderToken, getToken, readFile, readerLink, saveReaderToken } from '@/lib/github';
import { useCollect } from '@/hooks/useCollect';
import { useData } from '@/store/data';
import { useUi, type ThemePreference } from '@/store/ui';

function Section({ id, title, description, children }: { id?: string; title: string; description: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-4 border-b border-line py-7 first:pt-0 last:border-0 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      <div>
        <h2 className="text-[15px] font-medium text-ink">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{description}</p>
      </div>
      <div className="min-w-0 max-w-xl">{children}</div>
    </section>
  );
}

function mask(token: string | null): string {
  return token ? `${token.slice(0, 11)}…${token.slice(-4)}` : '—';
}

export function Settings() {
  const { db, metrics, mutate, connect, disconnect } = useData();
  const { theme, setTheme, toast } = useUi();
  const { collect, collecting } = useCollect();
  const location = useLocation();
  const [newToken, setNewToken] = useState('');
  const [switching, setSwitching] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [readerInput, setReaderInput] = useState('');
  const [readerLinkValue, setReaderLinkValue] = useState(readerLink);
  const [checkingReader, setCheckingReader] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  const switchToken = async (event: FormEvent) => {
    event.preventDefault();
    setSwitching(true);
    const ok = await connect(newToken.trim());
    setSwitching(false);
    if (ok) {
      setNewToken('');
      toast('Token atualizado.');
    } else {
      toast('Esse token não tem acesso ao banco. O anterior continua ativo.', 'error');
    }
  };

  const saveReader = async (event: FormEvent) => {
    event.preventDefault();
    const token = readerInput.trim();
    if (token === getToken()) {
      toast('Esse é o seu token de edição. Crie um token separado, só de leitura.', 'error');
      return;
    }
    setCheckingReader(true);
    try {
      await readFile('db.json', token);
      saveReaderToken(token);
      setReaderLinkValue(readerLink());
      setReaderInput('');
      toast('Acesso de leitura configurado.');
    } catch {
      toast('Esse token não consegue ler o jessicafreire-data.', 'error');
    } finally {
      setCheckingReader(false);
    }
  };

  const copyReader = async () => {
    if (!readerLinkValue) return;
    await navigator.clipboard.writeText(readerLinkValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="rounded-xl border border-line bg-panel px-5 py-7 sm:px-8">
        <Section title="Banco de dados" description={<>Pautas, relatórios e canais ficam no repositório privado <b className="font-medium text-ink">{DATA_REPO.split('/')[1]}</b>, salvos a cada alteração. A senha de acesso destrava esse acesso em cada aparelho.</>}>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken px-4 py-3">
            <div>
              <SyncIndicator withLabel />
              <p className="mt-0.5 pl-2.5 font-mono text-2xs text-ink-3">{mask(getToken())}</p>
            </div>
            <a href={`https://github.com/${DATA_REPO}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-info hover:underline">
              Abrir repositório <ExternalLink size={13} aria-hidden />
            </a>
          </div>
          <p className="mt-4 text-[13px] text-ink-2">
            Para trocar a senha de acesso, rode <code className="rounded bg-sunken px-1 py-0.5 text-xs">npm run senha</code> no projeto e publique. Quem já entrou continua conectado.
          </p>
          <form onSubmit={switchToken} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Trocar token (manutenção)" className="flex-1">
              <Input type="password" autoComplete="off" value={newToken} onChange={(event) => setNewToken(event.target.value)} placeholder="github_pat_..." />
            </Field>
            <Button type="submit" icon={KeyRound} loading={switching} disabled={!newToken.trim()}>
              Trocar
            </Button>
          </form>
          <Button variant="danger" icon={LogOut} size="sm" className="mt-3 -ml-2.5" onClick={() => setConfirmDisconnect(true)}>
            Desconectar este navegador
          </Button>
        </Section>

        <Section title="Canal gerenciado" description="O @ define qual canal a coleta trata como o da Jéssica. Mudou o @, rode uma coleta.">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome">
              <Input value={db.profile.name} onChange={(event) => mutate((draft) => void (draft.profile.name = event.target.value))} />
            </Field>
            <Field label="@ do canal">
              <Input value={db.profile.handle} onChange={(event) => mutate((draft) => void (draft.profile.handle = event.target.value.trim()))} />
            </Field>
          </div>
        </Section>

        <Section
          id="leitura"
          title="Link da Jéssica"
          description="A Jéssica abre só os relatórios publicados, sem menu e sem edição. Use um token separado, só de leitura, para poder revogar sem afetar o seu."
        >
          {readerLinkValue ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-sunken p-2 pl-3">
                <p className="min-w-0 flex-1 truncate font-mono text-xs text-ink-2">{readerLinkValue.replace(/acesso=.*/, 'acesso=••••••')}</p>
                <Button size="sm" icon={copied ? Check : Copy} onClick={() => void copyReader()}>
                  {copied ? 'Copiado' : 'Copiar link'}
                </Button>
              </div>
              <p className="text-xs text-ink-2">Mande pelo WhatsApp. Para testar, abra numa janela anônima: abrir aqui troca este navegador para o modo leitura.</p>
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                className="-ml-2.5"
                onClick={() => {
                  saveReaderToken(null);
                  setReaderLinkValue(null);
                  toast('Link removido deste navegador. Revogue o token no GitHub para cortar o acesso.');
                }}
              >
                Remover link
              </Button>
            </div>
          ) : (
            <>
              <ol className="mb-4 list-decimal space-y-1.5 pl-4 text-[13px] text-ink-2">
                <li>
                  Crie um{' '}
                  <a className="text-info hover:underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                    token fine-grained
                  </a>{' '}
                  chamado "Jéssica leitura"
                </li>
                <li>Repository access: só o jessicafreire-data</li>
                <li>
                  Permissions: <b className="font-medium text-ink">Contents: Read-only</b> (nada mais)
                </li>
              </ol>
              <form onSubmit={saveReader} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label="Token só leitura" className="flex-1" hint={getReaderToken() ? undefined : 'Fica salvo só neste navegador, para gerar o link.'}>
                  <Input type="password" autoComplete="off" value={readerInput} onChange={(event) => setReaderInput(event.target.value)} placeholder="github_pat_..." />
                </Field>
                <Button type="submit" variant="primary" loading={checkingReader} disabled={!readerInput.trim()} className="sm:mb-5">
                  Gerar link
                </Button>
              </form>
            </>
          )}
        </Section>

        <Section title="Coleta de métricas" description="Um GitHub Actions busca inscritos, views totais e os últimos 15 vídeos de cada canal, sem chave de API.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-sunken px-4 py-3">
              <dt className="text-xs text-ink-2">Última coleta</dt>
              <dd className="mt-0.5 font-medium">{metrics ? formatAge(metrics.updatedAt) : '—'}</dd>
              {metrics ? <dd className="text-2xs text-ink-3">{formatDate(metrics.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</dd> : null}
            </div>
            <div className="rounded-lg bg-sunken px-4 py-3">
              <dt className="text-xs text-ink-2">Automática</dt>
              <dd className="mt-0.5 font-medium">06h e 18h</dd>
              <dd className="text-2xs text-ink-3">horário de Brasília</dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button icon={RefreshCw} loading={collecting} onClick={() => void collect()}>
              Coletar agora
            </Button>
            <a href={`https://github.com/${DATA_REPO}/actions`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-info hover:underline">
              Ver execuções <ExternalLink size={13} aria-hidden />
            </a>
          </div>
        </Section>

        <Section title="Ideias com IA" description="O botão Gerar ideias, em O que gravar, roda no GitHub Actions com a API do Claude. A chave fica como secret do repositório de dados, nunca no navegador.">
          <ol className="list-decimal space-y-1.5 pl-4 text-[13px] text-ink-2">
            <li>
              Crie uma chave em{' '}
              <a className="text-info hover:underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                console.anthropic.com
              </a>
            </li>
            <li>
              Salve como{' '}
              <a className="text-info hover:underline" href={`https://github.com/${DATA_REPO}/settings/secrets/actions/new`} target="_blank" rel="noreferrer">
                secret do repositório
              </a>{' '}
              com o nome <code className="rounded bg-sunken px-1 py-0.5 text-xs">ANTHROPIC_API_KEY</code>
            </li>
          </ol>
          <p className="mt-3 text-xs text-ink-3">Cada rodada de 6 ideias custa alguns centavos de dólar.</p>
        </Section>

        <Section title="Aparência" description="Seguir o sistema troca sozinho entre claro e escuro.">
          <SegmentedControl<ThemePreference>
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: 'Sistema' },
              { value: 'light', label: 'Claro' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </Section>
      </div>

      <ConfirmDialog
        open={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        title="Desconectar este navegador?"
        description="O token e a cópia local dos dados saem deste navegador. O banco no GitHub continua intacto."
        confirmLabel="Desconectar"
        onConfirm={disconnect}
      />
    </>
  );
}
