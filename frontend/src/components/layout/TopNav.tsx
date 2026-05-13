/** @format */

import { Link, useLocation } from 'react-router-dom';
import { Activity, Boxes, GitPullRequest, Shield } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';

export function TopNav() {
  const location = useLocation();
  const connected = usePigeonStore((s) => s.connected);
  const shipments = usePigeonStore((s) => s.shipments);
  const pendingDecisions = usePigeonStore((s) => s.pendingDecisions);

  const criticalCount = Array.from(shipments.values()).filter(
    (s) => s.weighted_risk_score >= 70
  ).length;

  const links = [
    { path: '/', label: 'Command Center', icon: Activity },
    { path: '/decisions', label: 'Approval Queue', icon: GitPullRequest },
  ];

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm flex items-center px-6 sticky top-0 z-50">
      <Link to="/" className="flex items-center gap-2.5 mr-10 group">
        <div className="w-8 h-8 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Shield className="w-4 h-4 text-sky-400" />
        </div>
        <span className="font-semibold text-sm tracking-tight text-slate-100">PIGEON</span>
      </Link>

      <nav className="flex items-center gap-1 mr-auto">
        {links.map((link) => {
          const active = location.pathname === link.path;
          const Icon = link.icon;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium transition-colors ${
                active
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {link.label}
              {link.path === '/decisions' && pendingDecisions.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-sm bg-amber-500/10 text-amber-400 text-[10px] font-mono">
                  {pendingDecisions.length}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Boxes className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">{shipments.size} shipments</span>
          {criticalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-sm bg-red-400/10 text-red-400 font-mono text-[10px]">
              {criticalCount} critical
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 pl-4 border-l border-slate-800">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-red-400'
            }`}
          />
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
