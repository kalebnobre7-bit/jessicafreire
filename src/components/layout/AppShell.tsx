import { ExternalLink, FilePlus2, Lightbulb, Menu as MenuIcon, Monitor, Moon, Play, Plus, Search, Sun, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Button, IconButton } from '@/components/ui/button';
import { Avatar } from '@/components/ui/media';
import { Menu } from '@/components/ui/overlay';
import { formatCompact } from '@/lib/format';
import { useCreate } from '@/hooks/useCreate';
import { useData } from '@/store/data';
import { useUi } from '@/store/ui';
import { CommandPalette } from './CommandPalette';
import { NAV_ITEMS, SETTINGS_ITEM } from './nav';
import { SyncIndicator } from './SyncIndicator';

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { db, analysis } = useData();
  const profile = analysis?.profile;
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group flex h-11 items-center gap-4 rounded-lg px-3 text-sm transition-colors duration-150 ${isActive ? 'bg-hover font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink'}`;
  const iconClass = (isActive: boolean) => (isActive ? 'text-accent' : 'text-ink-2 group-hover:text-ink');

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center px-4 pt-6 pb-5 text-center">
        <Avatar src={profile?.avatar} name={db.profile.name} size={72} />
        <p className="mt-3 text-[13px] text-ink-2">Canal gerenciado</p>
        <p className="text-sm font-medium text-ink">{db.profile.name}</p>
        <a href={`https://www.youtube.com/${db.profile.handle}`} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink-2">
          {db.profile.handle}
          {profile?.subscribers != null ? ` · ${formatCompact(profile.subscribers)} inscritos` : ''}
          <ExternalLink size={11} aria-hidden />
        </a>
      </div>
      <nav aria-label="Áreas do sistema" className="flex flex-1 flex-col gap-0.5 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.1 : 1.8} className={iconClass(isActive)} aria-hidden />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <div className="mt-auto border-t border-line pt-2 pb-3">
          <NavLink to={SETTINGS_ITEM.to} className={linkClass} onClick={onNavigate}>
            {({ isActive }) => (
              <>
                <SETTINGS_ITEM.icon size={20} strokeWidth={isActive ? 2.1 : 1.8} className={iconClass(isActive)} aria-hidden />
                {SETTINGS_ITEM.label}
              </>
            )}
          </NavLink>
        </div>
      </nav>
    </div>
  );
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, setTheme } = useUi();
  const { createPauta, createReport } = useCreate();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <div className="min-h-dvh bg-canvas">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-panel focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-panel px-2 sm:px-4">
        <IconButton icon={MenuIcon} label="Abrir menu" className="lg:hidden" onClick={() => setDrawerOpen(true)} />
        <Link to="/" className="flex items-center gap-2 rounded-lg px-1.5 py-1" aria-label="JF Studio, visão geral">
          <span className="flex h-6 w-8 items-center justify-center rounded-md bg-accent text-on-accent">
            <Play size={13} fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <span className="hidden text-[17px] font-medium tracking-[-0.02em] text-ink sm:inline">
            JF <span className="font-normal">Studio</span>
          </span>
        </Link>

        <div className="flex flex-1 justify-center px-2">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 w-full max-w-xl items-center gap-3 rounded-full border border-line-strong bg-canvas px-4 text-left text-sm text-ink-3 transition-colors duration-150 hover:border-ink-3"
          >
            <Search size={18} className="shrink-0 text-ink-2" aria-hidden />
            <span className="hidden flex-1 truncate sm:inline">Buscar pautas, vídeos e canais</span>
            <span className="flex-1 truncate sm:hidden">Buscar</span>
            <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-sans text-2xs text-ink-3 md:inline">⌘K</kbd>
          </button>
        </div>

        <SyncIndicator />
        <Menu
          trigger={({ toggle, open, id }) => <IconButton icon={ThemeIcon} label="Tema" onClick={toggle} aria-expanded={open} aria-controls={id} />}
          items={[
            { label: 'Seguir o sistema', icon: Monitor, onSelect: () => setTheme('system'), hint: theme === 'system' ? 'ativo' : undefined },
            { label: 'Claro', icon: Sun, onSelect: () => setTheme('light'), hint: theme === 'light' ? 'ativo' : undefined },
            { label: 'Escuro', icon: Moon, onSelect: () => setTheme('dark'), hint: theme === 'dark' ? 'ativo' : undefined },
          ]}
        />
        <Menu
          trigger={({ toggle, open, id }) => (
            <Button icon={Plus} onClick={toggle} aria-expanded={open} aria-controls={id} className="[&>svg]:text-accent">
              <span className="hidden sm:inline">Criar</span>
            </Button>
          )}
          items={[
            { label: 'Nova pauta', icon: Lightbulb, onSelect: () => createPauta() },
            { label: 'Adicionar canal ao radar', icon: UserPlus, onSelect: () => navigate('/radar?aba=canais&novo=1') },
            { label: 'Novo relatório', icon: FilePlus2, onSelect: createReport },
          ]}
        />
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-panel lg:block">
          <Sidebar />
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Fechar menu" className="fade-in absolute inset-0 bg-[oklch(0.15_0.01_30/0.5)]" onClick={() => setDrawerOpen(false)} />
            <aside className="fade-in absolute inset-y-0 left-0 w-72 overflow-y-auto bg-panel shadow-pop">
              <div className="flex h-14 items-center justify-between border-b border-line px-3">
                <span className="text-[15px] font-medium">JF Studio</span>
                <IconButton icon={X} label="Fechar menu" onClick={() => setDrawerOpen(false)} />
              </div>
              <div className="h-[calc(100%-3.5rem)]">
                <Sidebar onNavigate={() => setDrawerOpen(false)} />
              </div>
            </aside>
          </div>
        ) : null}

        <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1320px]">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
