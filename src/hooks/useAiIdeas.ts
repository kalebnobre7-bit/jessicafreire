import { useCallback, useEffect, useState } from 'react';
import { ApiError, isAuthError, readDataFile, startWorkflow } from '@/lib/api';
import type { AiRun } from '@/lib/types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A geração roda no GitHub Actions; a página só dispara e espera o ai-ideas.json mudar.
// O estado fica no módulo para sobreviver a trocas de página enquanto a IA trabalha.
let generatingSince: number | null = null;

async function readRuns(): Promise<AiRun[]> {
  try {
    return (await readDataFile<{ runs: AiRun[] }>('ideas')).runs;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return [];
    throw error;
  }
}

export function useAiIdeas() {
  const [runs, setRuns] = useState<AiRun[] | null>(null);
  const [generating, setGenerating] = useState(generatingSince !== null);

  const reload = useCallback(async () => {
    try {
      setRuns(await readRuns());
    } catch {
      setRuns((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const generate = useCallback(async (focus: string): Promise<'done' | 'slow' | 'forbidden' | 'failed'> => {
    const before = (await readRuns().catch(() => []))[0]?.id;
    generatingSince = Date.now();
    setGenerating(true);
    try {
      await startWorkflow('recommend.yml', { focus });
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await wait(10_000);
        const latest = await readRuns();
        if (latest[0]?.id !== before) {
          setRuns(latest);
          return 'done';
        }
      }
      return 'slow';
    } catch (error) {
      return isAuthError(error) ? 'forbidden' : 'failed';
    } finally {
      generatingSince = null;
      setGenerating(false);
    }
  }, []);

  return { runs, generating, generate, reload };
}
