/** @format */

import { Routes, Route } from 'react-router-dom';
import { useSSE } from './hooks/useSSE';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ShipmentDetailPage } from './pages/ShipmentDetailPage';
import { DecisionsPage } from './pages/DecisionsPage';

function SSEWrapper({ children }: { children: React.ReactNode }) {
  useSSE();
  return children;
}

function App() {
  return (
    <SSEWrapper>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/decisions" element={<DecisionsPage />} />
        </Routes>
      </Layout>
    </SSEWrapper>
  );
}

export default App;
