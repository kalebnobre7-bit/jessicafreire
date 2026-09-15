import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { Connect } from './pages/Connect';
import { NotFound } from './pages/NotFound';
import { Overview } from './pages/Overview';
import { PautaEditor } from './pages/PautaEditor';
import { Pautas } from './pages/Pautas';
import { Radar } from './pages/Radar';
import { ReportEditor } from './pages/ReportEditor';
import { ReportReader } from './pages/ReportReader';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { VideoDetail } from './pages/VideoDetail';
import { Videos } from './pages/Videos';
import { DataProvider, useData } from './store/data';
import { UiProvider, useUi } from './store/ui';

function DataLayer({ children }: { children: ReactNode }) {
  const { toast } = useUi();
  return <DataProvider onConflict={() => toast('Os dados mudaram em outro aparelho. Carreguei a versão mais recente; refaça a última alteração.', 'error')}>{children}</DataProvider>;
}

function AppRoutes() {
  const { connected, mode } = useData();

  // Link da Jéssica: só o relatório, sem menu e sem edição
  if (mode === 'leitura' || !connected) {
    return (
      <Routes>
        <Route path="/r" element={<ReportReader />} />
        <Route path="/r/:id" element={<ReportReader />} />
        <Route path="*" element={mode === 'leitura' ? <Navigate to="/r" replace /> : <Connect />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/r" element={<ReportReader />} />
      <Route path="/r/:id" element={<ReportReader />} />
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="videos" element={<Videos />} />
        <Route path="videos/:id" element={<VideoDetail />} />
        <Route path="pautas" element={<Pautas />} />
        <Route path="pautas/:id" element={<PautaEditor />} />
        <Route path="radar" element={<Radar />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="relatorios/:id" element={<ReportEditor />} />
        <Route path="config" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <UiProvider>
      <DataLayer>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </DataLayer>
    </UiProvider>
  );
}
