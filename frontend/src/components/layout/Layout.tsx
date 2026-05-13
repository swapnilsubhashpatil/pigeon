/** @format */

import { TopNav } from './TopNav';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-surface-950">
      <TopNav />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
