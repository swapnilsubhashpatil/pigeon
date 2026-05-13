/** @format */

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import { Layout } from './components/layout/Layout';
import { MobileNav } from './components/layout/MobileNav';
import { CommandPalette } from './components/ui/CommandPalette';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { PageTransition } from './components/ui/PageTransition';
import { KeyboardShortcuts } from './components/ui/KeyboardShortcuts';
import { DashboardPage } from './pages/DashboardPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { NotFoundPage } from './pages/NotFoundPage';

function SSEWrapper({ children }: { children: React.ReactNode }) {
  useSSE();
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <PageTransition>
      <Routes location={location}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
        <Route path="/decisions" element={<DecisionsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </PageTransition>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SSEWrapper>
        <Layout>
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
          <CommandPalette />
          <KeyboardShortcuts />
        </Layout>
        <MobileNav />
      </SSEWrapper>
    </BrowserRouter>
  );
}

export default App;
