/** @format */

import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '../../store/useToastStore';

const ICONS = { success: CheckCircle, error: AlertCircle, info: Info };
const STYLES = {
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-400',
  info: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = ICONS[toast.type];
        return (
          <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-2xl min-w-[300px] animate-slide-in ${STYLES[toast.type]}`}>
            <Icon className="w-4 h-4 shrink-0" />
            <span className="text-xs font-semibold flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
          </div>
        );
      })}
    </div>
  );
}
