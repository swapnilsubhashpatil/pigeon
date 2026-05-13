/** @format */

import { Link, useLocation } from 'react-router-dom';
import { Activity, GitPullRequest, Shield } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function TopNav() {
  const location = useLocation();
  const connected = usePigeonStore((s) => s.connected);
  const shipments = usePigeonStore((s) => s.shipments);
  const pendingDecisions = usePigeonStore((s) => s.pendingDecisions);
  const isOnline = useNetworkStatus();

  const criticalCount = Array.from(shipments.values()).filter((s) => s.weighted_risk_score >= 70).length;

  const links = [
    { path: '/', label: 'Command', icon: Activity },
    { path: '/decisions', label: 'Queue', icon: GitPullRequest },
  ];

  return (
    <header className="h-14 glass flex items-center px-6 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2.5 mr-10">
        <div className="w-7 h-7 rounded-md bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight text-gray-100">PIGEON</span>
      </Link>

      <nav className="flex items-center gap-1 mr-auto">
        {links.map((link) => {
          const active = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {link.label}
              {link.path === '/decisions' && pendingDecisions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-mono">
                  {pendingDecisions.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-5">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-600">Shipments</span>
            <span className="font-mono text-gray-300">{shipments.size}</span>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-red-400">{criticalCount} Critical</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-white/5">
          {!isOnline ? (
            <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">Offline</span>
          ) : (
            <>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
              <span className={`text-[10px] font-mono uppercase tracking-wider ${connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {connected ? 'LIVE' : 'SYNCING'}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
