// Estado global: banco (db.json) + métricas (metrics.json), com cópia local para abrir instantâneo
// e sincronização com o repositório privado via API do GitHub.
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyzeMetrics, type Analysis } from '@/lib/analytics';
import { EMPTY_DATABASE, normalizeDatabase } from '@/lib/database';
import { GitHubError, getMode, getToken, isAuthError, readFile, readRawFile, saveAccess, startCollection, writeFile, type AccessMode } from '@/lib/github';
import type { Database, Metrics } from '@/lib/types';

const DB_KEY = 'jf:db';
const METRICS_KEY = 'jf:metrics';

export type SyncStatus = 'offline-local' | 'loading' | 'saved' | 'pending' | 'saving' | 'error' | 'unreachable' | 'auth';

interface DataContextValue {
  db: Database;
  metrics: Metrics | null;
  analysis: Analysis | null;
  mode: AccessMode;
  connected: boolean;
  ready: boolean;
  sync: SyncStatus;
  collecting: boolean;
  mutate: (recipe: (draft: Database) => void) => void;
  // Banco mais recente, inclusive mutações do mesmo clique que ainda não renderizaram
  getDb: () => Database;
  connect: (token: string, mode?: AccessMode) => Promise<boolean>;
  disconnect: () => void;
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
  const [token, setToken] = useState(getToken);
  const [mode, setMode] = useState<AccessMode>(getMode);
  const [db, setDb] = useState<Database>(() => normalizeDatabase(readLocal(DB_KEY) ?? EMPTY_DATABASE));
  const [metrics, setMetrics] = useState<Metrics | null>(() => readLocal(METRICS_KEY) as Metrics | null);
  const [sync, setSync] = useState<SyncStatus>(token ? 'loading' : 'offline-local');
  const [ready, setReady] = useState(!token);
  const [collecting, setCollecting] = useState(false);

  // Refs: a sincronização roda fora do ciclo de render (timers, foco da aba)
  const dbRef = useRef(db);
  const shaRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const lastPullRef = useRef(0);

  const applyDb = useCallback((next: Database) => {
    dbRef.current = next;
    setDb(next);
    localStorage.setItem(DB_KEY, JSON.stringify(next));
  }, []);

  const pullDb = useCallback(async (force = false): Promise<boolean> => {
    if (!getToken() || (!force && (dirtyRef.current || savingRef.current))) return false;
    lastPullRef.current = Date.now();
    try {
      const file = await readFile('db.json');
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
    if (!getToken()) return;
    try {
      const value = (await readRawFile('metrics.json')) as Metrics;
      setMetrics(value);
      localStorage.setItem(METRICS_KEY, JSON.stringify(value));
    } catch (error) {
      if (!(error instanceof GitHubError && error.status === 404)) console.warn('Falha ao ler metrics.json', error);
    }
  }, []);

  const pushDb = useCallback(async (): Promise<void> => {
    window.clearTimeout(timerRef.current);
    if (savingRef.current || !dirtyRef.current || !getToken() || getMode() === 'leitura') return;
    savingRef.current = true;
    dirtyRef.current = false;
    setSync('saving');
    try {
      shaRef.current = await writeFile('db.json', dbRef.current, shaRef.current, 'Atualiza dados pelo painel');
      savingRef.current = false;
      if (dirtyRef.current) {
        setSync('pending');
        timerRef.current = window.setTimeout(pushDb, 1200);
      } else {
        setSync('saved');
      }
    } catch (error) {
      savingRef.current = false;
      if (error instanceof GitHubError && (error.status === 409 || error.status === 422)) {
        const remote = await readFile('db.json').catch(() => null);
        if (remote && remote.sha === shaRef.current) {
          // O db.json não mudou: o 409 veio de outro commit chegando junto (print, coleta). Tenta de novo.
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
    if (getMode() === 'leitura') return;
    const draft = structuredClone(dbRef.current);
    recipe(draft);
    applyDb(draft);
    if (!getToken()) return;
    dirtyRef.current = true;
    setSync('pending');
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(pushDb, 1200);
  }, [applyDb, pushDb]);

  const connect = useCallback(async (nextToken: string, nextMode: AccessMode = 'editor') => {
    const previous = { token: getToken(), mode: getMode() };
    saveAccess(nextToken, nextMode);
    setSync('loading');
    shaRef.current = null;
    if (await pullDb(true)) {
      setToken(nextToken);
      setMode(nextMode);
      await pullMetrics();
      setReady(true);
      return true;
    }
    saveAccess(previous.token, previous.mode);
    setSync(previous.token ? 'auth' : 'offline-local');
    return false;
  }, [pullDb, pullMetrics]);

  const disconnect = useCallback(() => {
    saveAccess(null);
    [DB_KEY, METRICS_KEY].forEach((key) => localStorage.removeItem(key));
    shaRef.current = null;
    dirtyRef.current = false;
    setToken(null);
    setMode('editor');
    applyDb(structuredClone(EMPTY_DATABASE));
    localStorage.removeItem(DB_KEY);
    setMetrics(null);
    setSync('offline-local');
  }, [applyDb]);

  const collect = useCallback(async () => {
    if (!getToken()) return 'failed' as const;
    setCollecting(true);
    const before = metrics?.updatedAt;
    try {
      while (savingRef.current) await wait(200);
      if (dirtyRef.current) await pushDb();
      await startCollection();
      for (let attempt = 0; attempt < 16; attempt += 1) {
        await wait(15_000);
        const value = (await readRawFile('metrics.json')) as Metrics;
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
    if (!token) return;
    void Promise.all([pullDb(true), pullMetrics()]).then(() => setReady(true));
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
    // Só reinicia quando o token muda; as funções usadas leem refs
  }, [token]);

  const analysis = useMemo(() => (metrics ? analyzeMetrics(metrics, db) : null), [metrics, db]);

  const value = useMemo<DataContextValue>(
    () => ({ db, metrics, analysis, mode, connected: Boolean(token), ready, sync, collecting, mutate, getDb, connect, disconnect, collect, retrySave }),
    [db, metrics, analysis, mode, token, ready, sync, collecting, mutate, getDb, connect, disconnect, collect, retrySave],
  );

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataContextValue {
  const context = use(DataContext);
  if (!context) throw new Error('useData precisa estar dentro de <DataProvider>');
  return context;
}
