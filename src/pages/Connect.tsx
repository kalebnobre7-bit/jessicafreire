import { Eye, EyeOff, LogIn, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { useData } from '@/store/data';

const MESSAGES = {
  senha: 'Senha incorreta.',
  limite: 'Muitas tentativas. Espere alguns minutos e tente de novo.',
  erro: 'Não consegui falar com o servidor. Tente de novo em instantes.',
};

export function Connect() {
  const { signIn } = useData();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const enter = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    const result = await signIn(password.trim());
    setLoading(false);
    if (result !== 'ok') setError(MESSAGES[result]);
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
            <Field label="Senha">
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
        <p className="mt-4 text-center text-2xs text-ink-3">Acesso restrito. As tentativas são limitadas.</p>
      </div>
    </div>
  );
}
