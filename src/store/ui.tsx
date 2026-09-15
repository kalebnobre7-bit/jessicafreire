// Tema (claro/escuro/sistema) e avisos rápidos (toasts)
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
const THEME_KEY = 'jf:theme';

interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'error';
}

interface UiContextValue {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemePreference) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() => (localStorage.getItem(THEME_KEY) as ThemePreference | null) ?? 'system');
  const [system, setSystem] = useState(systemTheme);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(systemTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? system : theme;
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
  }, [resolvedTheme]);

  const setTheme = useCallback((value: ThemePreference) => {
    localStorage.setItem(THEME_KEY, value);
    setThemeState(value);
  }, []);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'neutral') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toast }), [theme, resolvedTheme, setTheme, toast]);

  return (
    <UiContext value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" role="status" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast-in pointer-events-auto max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${item.tone === 'error' ? 'bg-down text-on-accent' : 'bg-ink text-canvas'}`}>
            {item.message}
          </div>
        ))}
      </div>
    </UiContext>
  );
}

export function useUi(): UiContextValue {
  const context = use(UiContext);
  if (!context) throw new Error('useUi precisa estar dentro de <UiProvider>');
  return context;
}
