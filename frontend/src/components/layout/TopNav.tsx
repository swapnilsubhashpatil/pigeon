/** @format */

import { Link, useLocation } from 'react-router-dom';
import { Activity, Boxes, GitPullRequest, Shield, Radio, WifiOff } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';

export function TopNav() {
  const location = useLocation();
  const connected = usePigeonStore((s) => s.connected);
  const shipments = usePigeonStore((s) => s.shipments);
  const pendingDecisions = usePigeonStore((s) => s.pendingDecisions);
  const isOnline = useNetworkStatus();

  const criticalCount = Array.from(shipments.values()).filter(
    (s) => s.weighted_risk_score >= 70
  ).length;

  const links = [
    { path: '/', label: 'Overview', icon: Activity },
    { path: '/decisions', label: 'Decisions', icon: GitPullRequest },
  ];

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-3 mr-12">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="font-semibold text-sm text-gray-900 tracking-tight">Pigeon</span>
          <span className="block text-[10px] text-gray-400 -mt-0.5">Supply Chain Command</span>
        </div>
      </Link>

      <nav className="flex items-center gap-1 mr-auto">
        {links.map((link) => {
          const active = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {link.label}
              {link.path === '/decisions' && pendingDecisions.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold">
                  {pendingDecisions.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Boxes className="w-4 h-4 text-gray-400" />
          <span>{shipments.size} active</span>
          {criticalCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
              {criticalCount} critical
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pl-6 border-l border-gray-200">
          {!isOnline ? (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-xs font-medium text-red-600">Offline</span>
            </>
          ) : (
            <>
              <Radio className={`w-4 h-4 ${connected ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className={`text-xs font-medium ${connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {connected ? 'Live' : 'Connecting...'}
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
