import { Eye, FileChartColumn, Plus } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, EmptyState, PageHeader, Panel } from '@/components/ui/feedback';
import { formatAge, formatPeriod } from '@/lib/format';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';

export function Reports() {
  const { db } = useData();
  const { createReport } = useCreate();
  const navigate = useNavigate();
  const reports = [...db.reports].sort((a, b) => b.to.localeCompare(a.to) || b.updatedAt - a.updatedAt);
  const published = reports.filter((report) => report.status === 'publicado').length;

  return (
    <>
      <PageHeader
        title="Relatórios"
        description={`${reports.length} ${reports.length === 1 ? 'relatório' : 'relatórios'} · ${published} ${published === 1 ? 'publicado' : 'publicados'} para a Jéssica`}
        actions={
          <>
            <ButtonLink to="/r" icon={Eye} target="_blank">
              Ver como a Jéssica
            </ButtonLink>
            <Button variant="primary" icon={Plus} onClick={createReport}>
              Novo relatório
            </Button>
          </>
        }
      />
      <Panel padded={false}>
        {reports.length ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-2">
                <th className="py-3 pl-5 font-medium">Relatório</th>
                <th className="hidden py-3 pr-4 font-medium sm:table-cell">Período</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="hidden py-3 pr-5 font-medium md:table-cell">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {reports.map((report) => (
                <tr key={report.id} className="cursor-pointer hover:bg-hover" onClick={() => navigate(`/relatorios/${report.id}`)}>
                  <td className="py-3 pr-4 pl-5">
                    <p className="font-medium text-ink">{report.title || 'Sem título'}</p>
                    <p className="text-xs text-ink-3 sm:hidden">{formatPeriod(report.from, report.to)}</p>
                  </td>
                  <td className="hidden py-3 pr-4 text-ink-2 sm:table-cell">{formatPeriod(report.from, report.to)}</td>
                  <td className="py-3 pr-4">{report.status === 'publicado' ? <Badge tone="up">Publicado</Badge> : <Badge>Rascunho</Badge>}</td>
                  <td className="hidden py-3 pr-5 text-xs text-ink-3 md:table-cell">{formatAge(report.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={FileChartColumn} title="Nenhum relatório ainda" action={<Button variant="primary" icon={Plus} onClick={createReport}>Criar o primeiro</Button>}>
            Escolha o período, os números entram sozinhos e você escreve o resumo e os próximos passos. Publicado, ele aparece no link da Jéssica.
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
