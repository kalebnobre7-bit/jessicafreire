import { FileChartColumn, LayoutDashboard, LibraryBig, MonitorPlay, Radar, Settings, Sparkles, SquareKanban, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/videos', label: 'Vídeos', icon: MonitorPlay },
  { to: '/pautas', label: 'Pautas', icon: SquareKanban },
  { to: '/o-que-gravar', label: 'O que gravar', icon: Sparkles },
  { to: '/radar', label: 'Radar', icon: Radar },
  { to: '/biblioteca', label: 'Biblioteca', icon: LibraryBig },
  { to: '/relatorios', label: 'Relatórios', icon: FileChartColumn },
];

export const SETTINGS_ITEM = { to: '/config', label: 'Configurações', icon: Settings };
