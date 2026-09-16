import { ExternalLink, LogOut, RefreshCw } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { SyncIndicator } from '@/components/layout/SyncIndicator';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/feedback';
import { Field, Input, SegmentedControl } from '@/components/ui/form';
import { DATA_REPO } from '@/lib/constants';
import { formatAge, formatDate } from '@/lib/format';
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

export function Settings() {
  const { db, metrics, mutate, signOut } = useData();
  const { theme, setTheme } = useUi();
  const { collect, collecting } = useCollect();
  const location = useLocation();

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [location.hash]);

  return (
    <>
      <PageHeader title="Configurações" />
      <div className="rounded-xl border border-line bg-panel px-5 py-7 sm:px-8">
        <Section title="Acesso" description="Quem entra com a senha usa o painel inteiro. O acesso ao GitHub fica no servidor do painel, nunca no navegador.">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken px-4 py-3">
            <SyncIndicator withLabel />
            <a href={`https://github.com/${DATA_REPO}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-info hover:underline">
              Abrir repositório de dados <ExternalLink size={13} aria-hidden />
            </a>
          </div>
          <p className="mt-4 text-[13px] text-ink-2">
            Para trocar a senha, mude a variável <code className="rounded bg-sunken px-1 py-0.5 text-xs">APP_PASSWORD</code> nas configurações do projeto na Vercel e publique de novo. Quem já entrou continua entrando até sair.
          </p>
          <Button variant="danger" icon={LogOut} size="sm" className="mt-3 -ml-2.5" onClick={signOut}>
            Sair deste aparelho
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
    </>
  );
}
