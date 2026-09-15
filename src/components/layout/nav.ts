import { FileChartColumn, LayoutDashboard, MonitorPlay, Radar, Settings, SquareKanban, type LucideIcon } from 'lucide-react';

export const NAV_ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/videos', label: 'Vídeos', icon: MonitorPlay },
  { to: '/pautas', label: 'Pautas', icon: SquareKanban },
  { to: '/radar', label: 'Radar', icon: Radar },
  { to: '/relatorios', label: 'Relatórios', icon: FileChartColumn },
];

export const SETTINGS_ITEM = { to: '/config', label: 'Configurações', icon: Settings };
