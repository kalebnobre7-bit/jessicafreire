import { useCallback } from 'react';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';

const MESSAGES = {
  done: 'Métricas atualizadas.',
  slow: 'A coleta está demorando. Os dados aparecem quando ela terminar.',
  forbidden: 'O token precisa da permissão Actions (Read and write) para iniciar a coleta.',
  failed: 'Não foi possível iniciar a coleta. Tente de novo em instantes.',
};

export function useCollect() {
  const { collect, collecting } = useData();
  const { toast } = useUi();
  const run = useCallback(async () => {
    toast('Coleta iniciada no GitHub. Leva cerca de 1 minuto.');
    const result = await collect();
    toast(MESSAGES[result], result === 'done' || result === 'slow' ? 'neutral' : 'error');
  }, [collect, toast]);
  return { collect: run, collecting };
}
