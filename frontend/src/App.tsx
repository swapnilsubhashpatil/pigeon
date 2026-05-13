/** @format */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import { Layout } from './components/layout/Layout';
import { CommandPalette } from './components/ui/CommandPalette';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DashboardPage } from './pages/DashboardPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { DecisionsPage } from './pages/DecisionsPage';

function SSEWrapper({ children }: { children: React.ReactNode }) {
  useSSE();
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <SSEWrapper>
        <Layout>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
              <Route path="/decisions" element={<DecisionsPage />} />
            </Routes>
          </ErrorBoundary>
          <CommandPalette />
        </Layout>
      </SSEWrapper>
    </BrowserRouter>
  );
}

export default App;
