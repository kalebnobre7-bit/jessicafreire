// Estado global: banco (db.json) + métricas (metrics.json), com cópia local para abrir instantâneo.
// Toda conversa com o GitHub passa pelo servidor do painel (/api), autenticado por sessão.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyzeMetrics, type Analysis } from '@/lib/analytics';
import { ApiError, checkSession, isAuthError, login, logout, readDataFile, readDb, startCollection, writeDb } from '@/lib/api';
import { EMPTY_DATABASE, normalizeDatabase } from '@/lib/database';
import type { Database, Metrics } from '@/lib/types';

const DB_KEY = 'jf:db';
const METRICS_KEY = 'jf:metrics';

export type SyncStatus = 'offline-local' | 'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'unreachable' | 'auth';

interface DataContextValue {
  db: Database;
  metrics: Metrics | null;
  analysis: Analysis | null;
  connected: boolean;
  ready: boolean;
  sync: SyncStatus;
  collecting: boolean;
  mutate: (recipe: (draft: Database) => void) => void;
  // Banco mais recente, inclusive mutações do mesmo clique que ainda não renderizaram
  getDb: () => Database;
  signIn: (password: string) => Promise<'ok' | 'senha' | 'limite' | 'erro'>;
  signOut: () => void;
  collect: () => Promise<'done' | 'slow' | 'forbidden' | 'failed'>;
  retrySave: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

function readLocal(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function DataProvider({ children, onConflict }: { children: ReactNode; onConflict: () => void }) {
  const [connected, setConnected] = useState(false);
  const [db, setDb] = useState<Database>(() => normalizeDatabase(readLocal(DB_KEY) ?? EMPTY_DATABASE));
  const [metrics, setMetrics] = useState<Metrics | null>(() => readLocal(METRICS_KEY) as Metrics | null);
  const [sync, setSync] = useState<SyncStatus>('loading');
  const [ready, setReady] = useState(false);
  const [collecting, setCollecting] = useState(false);

  // Refs: a sincronização roda fora do ciclo de render (timers, foco da aba)
  const dbRef = useRef(db);
  const shaRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const lastPullRef = useRef(0);
  const connectedRef = useRef(false);

  const applyDb = useCallback((next: Database) => {
    dbRef.current = next;
    setDb(next);
    localStorage.setItem(DB_KEY, JSON.stringify(next));
  }, []);

  const pullDb = useCallback(async (force = false): Promise<boolean> => {
    if (!connectedRef.current || (!force && (dirtyRef.current || savingRef.current))) return false;
    lastPullRef.current = Date.now();
    try {
      const file = await readDb();
      // A pessoa editou enquanto a leitura estava em andamento: não sobrescreve a edição local
      if (!force && (dirtyRef.current || savingRef.current)) return false;
      if (force || file.sha !== shaRef.current) {
        shaRef.current = file.sha;
        dirtyRef.current = false;
        applyDb(normalizeDatabase(file.value));
      }
      setSync('saved');
      return true;
    } catch (error) {
      setSync(isAuthError(error) ? 'auth' : 'unreachable');
      return false;
    }
  }, [applyDb]);

  const pullMetrics = useCallback(async () => {
    if (!connectedRef.current) return;
    try {
      const value = await readDataFile<Metrics>('metrics');
      setMetrics(value);
      localStorage.setItem(METRICS_KEY, JSON.stringify(value));
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 404)) console.warn('Falha ao ler as métricas', error);
    }
  }, []);

  const pushDb = useCallback(async (): Promise<void> => {
    window.clearTimeout(timerRef.current);
    if (savingRef.current || !dirtyRef.current || !connectedRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    setSync('saving');
    try {
      shaRef.current = await writeDb(dbRef.current, shaRef.current, 'Atualiza dados pelo painel');
      savingRef.current = false;
      if (dirtyRef.current) {
        setSync('pending');
        timerRef.current = window.setTimeout(pushDb, 1200);
      } else {
        setSync('saved');
      }
    } catch (error) {
      savingRef.current = false;
      if (error instanceof ApiError && (error.status === 409 || error.status === 422)) {
        const remote = await readDb().catch(() => null);
        if (remote && remote.sha === shaRef.current) {
          // O db.json não mudou: o conflito veio de outro commit chegando junto (print, coleta). Tenta de novo.
          dirtyRef.current = true;
          setSync('pending');
          timerRef.current = window.setTimeout(pushDb, 1500);
          return;
        }
        // Outro aparelho salvou antes: fica com a versão do banco para não sobrescrever o trabalho de ninguém
        await pullDb(true);
        onConflict();
        return;
      }
      dirtyRef.current = true;
      setSync(isAuthError(error) ? 'auth' : 'error');
    }
  }, [onConflict, pullDb]);

  const mutate = useCallback((recipe: (draft: Database) => void) => {
    const draft = structuredClone(dbRef.current);
    recipe(draft);
    applyDb(draft);
    if (!connectedRef.current) return;
    dirtyRef.current = true;
    setSync('pending');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(pushDb, 1200);
  }, [applyDb, pushDb]);

  const load = useCallback(async () => {
    connectedRef.current = true;
    setConnected(true);
    shaRef.current = null;
    await Promise.all([pullDb(true), pullMetrics()]);
    setReady(true);
  }, [pullDb, pullMetrics]);

  const signIn = useCallback(async (password: string) => {
    const result = await login(password);
    if (result === 'ok') await load();
    return result;
  }, [load]);

  const signOut = useCallback(() => {
    void logout();
    connectedRef.current = false;
    shaRef.current = null;
    dirtyRef.current = false;
    setConnected(false);
    applyDb(structuredClone(EMPTY_DATABASE));
    [DB_KEY, METRICS_KEY].forEach((key) => localStorage.removeItem(key));
    setMetrics(null);
    setSync('offline-local');
  }, [applyDb]);

  const collect = useCallback(async () => {
    if (!connectedRef.current) return 'failed' as const;
    setCollecting(true);
    const before = metrics?.updatedAt;
    try {
      while (savingRef.current) await wait(200);
      if (dirtyRef.current) await pushDb();
      await startCollection();
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await wait(15_000);
        const value = await readDataFile<Metrics>('metrics');
        if (value.updatedAt !== before) {
          setMetrics(value);
          localStorage.setItem(METRICS_KEY, JSON.stringify(value));
          return 'done' as const;
        }
      }
      return 'slow' as const;
    } catch (error) {
      return isAuthError(error) ? ('forbidden' as const) : ('failed' as const);
    } finally {
      setCollecting(false);
    }
  }, [metrics?.updatedAt, pushDb]);

  const getDb = useCallback(() => dbRef.current, []);

  const retrySave = useCallback(() => {
    dirtyRef.current = true;
    void pushDb();
  }, [pushDb]);

  // Primeira carga e atualização quando a aba volta ao foco
  useEffect(() => {
    void checkSession().then((authenticated) => {
      if (authenticated) return load();
      setSync('offline-local');
      setReady(true);
      return undefined;
    });
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (dirtyRef.current) void pushDb();
      } else if (Date.now() - lastPullRef.current > 30_000) {
        void pullDb();
        void pullMetrics();
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) event.preventDefault();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
    // Roda uma vez na montagem: as funções usadas leem refs
  }, []);

  const analysis = useMemo(() => (metrics ? analyzeMetrics(metrics, db) : null), [metrics, db]);

  const value = useMemo<DataContextValue>(
    () => ({ db, metrics, analysis, connected, ready, sync, collecting, mutate, getDb, signIn, signOut, collect, retrySave }),
    [db, metrics, analysis, connected, ready, sync, collecting, mutate, getDb, signIn, signOut, collect, retrySave],
  );

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataContextValue {
  const context = use(DataContext);
  if (!context) throw new Error('useData precisa estar dentro de <DataProvider>');
  return context;
}
