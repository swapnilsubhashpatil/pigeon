/** @format */

import { ToastContainer } from '../ui/ToastContainer';
import { GlobalProgress } from '../ui/GlobalProgress';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-bg-primary bg-grid relative">
      <GlobalProgress />
      <main className="flex-1 overflow-auto p-6 lg:p-8 pb-20 lg:pb-8">
        {children}
      </main>
      <ToastContainer />
    </div>
  );
}
