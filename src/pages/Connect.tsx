import { ArrowUpRight, KeyRound, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { DATA_REPO } from '@/lib/constants';
import { useData } from '@/store/data';

export function Connect() {
  const { connect } = useData();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const ok = await connect(token.trim());
    setLoading(false);
    if (!ok) setError(`Esse token não tem acesso ao repositório ${DATA_REPO}. Confira as permissões abaixo.`);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-7 w-9 items-center justify-center rounded-md bg-accent text-on-accent">
            <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <span className="text-lg font-medium tracking-[-0.02em]">
            JF <span className="font-normal">Studio</span>
          </span>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-xl font-medium">Conectar ao banco</h1>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Pautas, relatórios e métricas ficam no repositório privado <b className="font-medium text-ink">jessicafreire-data</b>. O token fica salvo só neste navegador.
          </p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Token do GitHub">
              <Input type="password" autoComplete="off" required value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_..." aria-invalid={Boolean(error)} />
            </Field>
            {error ? (
              <p className="rounded-lg bg-down-soft px-3 py-2 text-xs text-down" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" icon={KeyRound} loading={loading} className="w-full">
              Conectar
            </Button>
          </form>
        </div>
        <div className="mt-4 rounded-2xl border border-line px-6 py-5 text-[13px] text-ink-2">
          <p className="font-medium text-ink">Como criar o token</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4">
            <li>
              Abra{' '}
              <a className="inline-flex items-center gap-0.5 text-info hover:underline" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noreferrer">
                novo token fine-grained <ArrowUpRight size={12} aria-hidden />
              </a>
            </li>
            <li>Repository access: só o <b className="font-medium text-ink">jessicafreire-data</b></li>
            <li>
              Permissions: <b className="font-medium text-ink">Contents</b> e <b className="font-medium text-ink">Actions</b> em Read and write
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
