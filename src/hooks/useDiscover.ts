import { useEffect, useState } from 'react';
import { ApiError, readDataFile } from '@/lib/api';
import type { Discover } from '@/lib/types';

// discover.json é gerado pela coleta (06h e 18h); antes da primeira busca ele ainda não existe
export function useDiscover() {
  const [discover, setDiscover] = useState<Discover | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'failed'>('loading');

  useEffect(() => {
    let active = true;
    readDataFile<Discover>('discover')
      .then((value) => {
        if (!active) return;
        setDiscover(value);
        setState('ready');
      })
      .catch((error: unknown) => {
        if (active) setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'failed');
      });
    return () => {
      active = false;
    };
  }, []);

  return { discover, state };
}
