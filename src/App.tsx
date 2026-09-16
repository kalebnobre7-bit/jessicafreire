import type { ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { ChannelDetail } from './pages/ChannelDetail';
import { Connect } from './pages/Connect';
import { Library } from './pages/Library';
import { NotFound } from './pages/NotFound';
import { Overview } from './pages/Overview';
import { PautaEditor } from './pages/PautaEditor';
import { Pautas } from './pages/Pautas';
import { Radar } from './pages/Radar';
import { Recommendations } from './pages/Recommendations';
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
  const { connected, ready } = useData();

  if (!connected) {
    // Enquanto confere a sessão, evita piscar a tela de entrada
    return ready ? <Connect /> : null;
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
        <Route path="o-que-gravar" element={<Recommendations />} />
        <Route path="radar" element={<Radar />} />
        <Route path="radar/:handle" element={<ChannelDetail />} />
        <Route path="biblioteca" element={<Library />} />
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
