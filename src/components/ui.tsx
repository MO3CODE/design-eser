'use client';
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { X, Check, AlertTriangle, Info, Loader2 } from 'lucide-react';

// ───── إشعارات ─────
interface T { id: number; msg: string; kind: 'ok' | 'err' | 'info' }
const useToasts = create<{ list: T[]; push: (m: string, k?: T['kind']) => void; drop: (id: number) => void }>(set => ({
  list: [],
  push: (msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    set(s => ({ list: [...s.list.filter(t => t.msg !== msg), { id, msg, kind }].slice(-4) }));
    setTimeout(() => set(s => ({ list: s.list.filter(t => t.id !== id) })), kind === 'err' ? 9000 : 4200);
  },
  drop: id => set(s => ({ list: s.list.filter(t => t.id !== id) })),
}));
export const toast = (m: string, k?: T['kind']) => useToasts.getState().push(m, k);

export function Toaster() {
  const { list, drop } = useToasts();
  return (
    <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 w-[min(380px,calc(100vw-32px))]">
      {list.map(t => (
        <div key={t.id} className="card shadow-card px-3.5 py-2.5 flex items-start gap-2.5 text-sm animate-in">
          <span className={`mt-0.5 shrink-0 ${t.kind === 'ok' ? 'text-ok' : t.kind === 'err' ? 'text-err' : 'text-accent'}`}>
            {t.kind === 'ok' ? <Check size={16} /> : t.kind === 'err' ? <AlertTriangle size={16} /> : <Info size={16} />}
          </span>
          <span className="flex-1 leading-relaxed">{t.msg}</span>
          <button className="text-muted hover:text-ink" onClick={() => drop(t.id)} aria-label="إغلاق"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className={`card shadow-card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90dvh] flex flex-col`} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="إغلاق"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto scroll-thin p-5">{children}</div>
      </div>
    </div>
  );
}

export function Spinner({ size = 16, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`spin ${className}`} />;
}

export function Segmented<V extends string>({ value, onChange, options, size = 'md' }:
  { value: V; onChange: (v: V) => void; options: { value: V; label: React.ReactNode; title?: string }[]; size?: 'sm' | 'md' }) {
  return (
    <div className="inline-flex p-0.5 rounded-lg bg-surface-2 border border-line">
      {options.map(o => (
        <button key={o.value} title={o.title} onClick={() => onChange(o.value)}
          className={`${size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm'} rounded-md font-medium transition-colors ${value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export const fmtCost = (c: number) => (c === 0 ? '$0' : c < 0.01 ? `$${c.toFixed(4)}` : `$${c.toFixed(3)}`);
export const fmtTok = (n: number) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n));
