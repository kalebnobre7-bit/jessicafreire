import { ArrowLeft, FileChartColumn, LockKeyhole, Moon, Play, Printer, Sun } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ReportDocument } from '@/components/ReportDocument';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/feedback';
import { Select } from '@/components/ui/form';
import { formatPeriod } from '@/lib/format';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

export function ReportReader() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { db, analysis, connected, ready } = useData();
  const { resolvedTheme, setTheme } = useUi();

  const reports = db.reports.filter((report) => report.status === 'publicado').sort((a, b) => b.to.localeCompare(a.to));
  const report = (id ? reports.find((item) => item.id === id) : undefined) ?? reports[0];
  const printing = params.get('imprimir') === '1';

  useEffect(() => {
    if (!printing || !ready || !report) return;
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = 'light';
    const timer = window.setTimeout(() => window.print(), 600);
    const restore = () => {
      if (previous) document.documentElement.dataset.theme = previous;
    };
    window.addEventListener('afterprint', restore, { once: true });
    return () => window.clearTimeout(timer);
  }, [printing, ready, report]);

  const shell = (content: ReactNode) => (
    <div className="min-h-dvh bg-canvas">
      <header className="no-print sticky top-0 z-20 border-b border-line bg-panel">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          {connected ? (
            <Link to="/relatorios" className="inline-flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
              <ArrowLeft size={16} aria-hidden /> Painel
            </Link>
          ) : (
            <span className="flex items-center gap-2 text-[15px] font-medium">
              <span className="flex h-6 w-8 items-center justify-center rounded-md bg-accent text-on-accent">
                <Play size={13} fill="currentColor" strokeWidth={0} aria-hidden />
              </span>
              Relatórios do canal
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {reports.length > 1 && report ? (
              <Select value={report.id} onChange={(event) => navigate(`/r/${event.target.value}`)} aria-label="Escolher relatório" className="h-8 w-auto max-w-52 text-[13px]">
                {reports.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatPeriod(item.from, item.to)}
                  </option>
                ))}
              </Select>
            ) : null}
            {report ? <IconButton icon={Printer} label="Imprimir ou salvar PDF" onClick={() => window.print()} /> : null}
            <IconButton icon={resolvedTheme === 'dark' ? Sun : Moon} label={resolvedTheme === 'dark' ? 'Tema claro' : 'Tema escuro'} onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">{content}</main>
    </div>
  );

  if (!connected) {
    return shell(
      <EmptyState icon={LockKeyhole} title="Link sem acesso">
        Este link de relatório não é mais válido neste navegador. Peça um link novo.
      </EmptyState>,
    );
  }
  if (!ready) return shell(<Skeleton className="h-[600px]" />);
  if (!report) {
    return shell(
      <EmptyState icon={FileChartColumn} title="Nenhum relatório publicado ainda" action={<Button onClick={() => navigate('/relatorios')}>Ir para relatórios</Button>}>
        Assim que um relatório for publicado, ele aparece aqui.
      </EmptyState>,
    );
  }

  return shell(
    <div className="rounded-2xl border border-line bg-panel px-5 py-7 sm:px-10 sm:py-10 print:border-0 print:p-0">
      <ReportDocument report={report} snapshot={report.snapshot} profile={{ name: db.profile.name, handle: db.profile.handle, avatar: analysis?.profile?.avatar ?? null }} />
    </div>,
  );
}
