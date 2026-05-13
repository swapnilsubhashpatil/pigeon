/** @format */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Command } from 'lucide-react';
import { usePigeonStore } from '../../store/usePigeonStore';
import { getRouteDisplay } from '../../lib/constants';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const shipments = usePigeonStore((s) => s.shipments);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [open]);

  const results = useCallback(() => {
    if (!query.trim()) return Array.from(shipments.values()).slice(0, 8);
    const q = query.toLowerCase();
    return Array.from(shipments.values()).filter(
      (s) =>
        s.shipment_id.toLowerCase().includes(q) ||
        s.carrier.toLowerCase().includes(q) ||
        s.origin.port.toLowerCase().includes(q) ||
        s.destination.port.toLowerCase().includes(q)
    );
  }, [query, shipments])();

  function handleSelect(shipmentId: string) {
    setOpen(false);
    navigate(`/shipments/${shipmentId}`);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-fade-in">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search shipments..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-base text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-xs text-gray-500 font-mono">
            <Command className="w-3 h-3" />
            K
          </kbd>
        </div>

        <div className="max-h-[400px] overflow-y-auto py-2">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              No shipments found
            </div>
          )}
          {results.map((s, i) => (
            <button
              key={s.shipment_id}
              onClick={() => handleSelect(s.shipment_id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-mono w-6">{i + 1}</span>
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">{s.shipment_id}</div>
                  <div className="text-xs text-gray-500">{getRouteDisplay(s)} · {s.carrier}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-mono font-semibold ${
                    s.weighted_risk_score >= 70
                      ? 'text-red-600'
                      : s.weighted_risk_score >= 40
                        ? 'text-amber-600'
                        : 'text-emerald-600'
                  }`}
                >
                  {s.weighted_risk_score}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">↵</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500">esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
