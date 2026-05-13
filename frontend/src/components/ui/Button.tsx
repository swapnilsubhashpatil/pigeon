/** @format */

import type { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

export function Button({ children, onClick, variant = 'secondary', size = 'md', disabled = false, className = '' }: ButtonProps) {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20',
    secondary: 'bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:border-white/20',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    ghost: 'bg-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5',
  };
  const sizes = { sm: 'px-2.5 py-1 text-[11px]', md: 'px-4 py-2 text-xs font-semibold' };

  return (
    <button onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
}
