import { ChevronDown, Eye, EyeOff, LogIn, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { unlockToken } from '@/lib/access';
import { DATA_REPO } from '@/lib/constants';
import { useData } from '@/store/data';

export function Connect() {
  const { connect } = useData();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enter = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    // Aceita a senha com espaços ou maiúsculas digitados no celular
    const unlocked = await unlockToken(password.trim().toLowerCase().replace(/\s+/g, '-'));
    if (!unlocked) {
      setLoading(false);
      setError('Senha incorreta. Confira os hífens entre as palavras.');
      return;
    }
    const ok = await connect(unlocked);
    setLoading(false);
    if (!ok) setError('A senha está certa, mas o acesso ao banco foi recusado. Avise o Kaleb para renovar o acesso.');
  };

  const enterWithToken = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const ok = await connect(token.trim());
    setLoading(false);
    if (!ok) setError(`Esse token não tem acesso ao repositório ${DATA_REPO}.`);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-7 w-9 items-center justify-center rounded-md bg-accent text-on-accent">
            <Play size={15} fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <span className="text-lg font-medium tracking-[-0.02em]">
            JF <span className="font-normal">Studio</span>
          </span>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-6">
          <h1 className="text-xl font-medium">Entrar</h1>
          <p className="mt-1 text-[13px] text-ink-2">Central do canal da Jéssica Freire. Depois de entrar, este aparelho fica lembrado.</p>
          <form onSubmit={enter} className="mt-5 space-y-4">
            <Field label="Senha de acesso">
              <div className="relative">
                <Input
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  autoFocus
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="palavra-palavra-palavra-palavra-000"
                  aria-invalid={Boolean(error)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Esconder senha' : 'Mostrar senha'} className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 hover:bg-hover hover:text-ink">
                  {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
            </Field>
            {error ? (
              <p className="rounded-lg bg-down-soft px-3 py-2 text-xs text-down" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" icon={LogIn} loading={loading} className="w-full">
              {loading ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </div>
        <details className="group mt-4 rounded-2xl border border-line px-5 py-3 text-[13px] text-ink-2">
          <summary className="flex cursor-pointer list-none items-center justify-between">
            Entrar com token do GitHub
            <ChevronDown size={15} className="transition-transform duration-150 group-open:rotate-180" aria-hidden />
          </summary>
          <form onSubmit={enterWithToken} className="mt-3 space-y-3 pb-1">
            <p className="text-xs">Só para manutenção. O token precisa acessar o {DATA_REPO.split('/')[1]} com Contents e Actions.</p>
            <Input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="github_pat_..." aria-label="Token do GitHub" />
            <Button type="submit" size="sm" loading={loading} disabled={!token.trim()}>
              Conectar com token
            </Button>
          </form>
        </details>
      </div>
    </div>
  );
}
