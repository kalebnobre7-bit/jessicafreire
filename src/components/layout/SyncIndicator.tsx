import { CloudAlert, CloudCheck, CloudOff, CloudUpload, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router';
import { useData, type SyncStatus } from '@/store/data';

const STATES: Record<SyncStatus, { label: string; icon: typeof CloudCheck; tone: string; spin?: boolean }> = {
  'offline-local': { label: 'Banco não conectado', icon: CloudOff, tone: 'text-ink-3' },
  loading: { label: 'Carregando dados', icon: LoaderCircle, tone: 'text-ink-2', spin: true },
  saved: { label: 'Tudo salvo no banco', icon: CloudCheck, tone: 'text-up' },
  pending: { label: 'Alterações a salvar', icon: CloudUpload, tone: 'text-warn' },
  saving: { label: 'Salvando', icon: CloudUpload, tone: 'text-warn' },
  error: { label: 'Erro ao salvar. Clique para tentar de novo', icon: CloudAlert, tone: 'text-down' },
  unreachable: { label: 'Sem conexão com o GitHub', icon: CloudOff, tone: 'text-down' },
  auth: { label: 'Token sem acesso ao banco', icon: CloudAlert, tone: 'text-down' },
};

export function SyncIndicator({ withLabel = false }: { withLabel?: boolean }) {
  const { sync, retrySave } = useData();
  const state = STATES[sync];
  const content = (
    <>
      <state.icon size={18} strokeWidth={1.9} className={`${state.tone} ${state.spin ? 'animate-spin' : ''}`} aria-hidden />
      {withLabel ? <span className="text-xs text-ink-2">{state.label}</span> : null}
    </>
  );
  const className = `inline-flex h-9 items-center gap-2 rounded-full ${withLabel ? 'px-2.5' : 'w-9 justify-center'} hover:bg-hover`;
  if (sync === 'error') {
    return (
      <button type="button" onClick={retrySave} className={className} title={state.label} aria-label={state.label}>
        {content}
      </button>
    );
  }
  return (
    <Link to="/config" className={className} title={state.label} aria-label={state.label}>
      {content}
    </Link>
  );
}
