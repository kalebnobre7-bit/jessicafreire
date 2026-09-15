import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, Panel } from '@/components/ui/feedback';

export function NotFound() {
  return (
    <Panel>
      <EmptyState icon={Compass} title="Página não encontrada" action={<ButtonLink to="/">Ir para a visão geral</ButtonLink>}>
        O endereço pode ter mudado com a nova versão do painel.
      </EmptyState>
    </Panel>
  );
}
