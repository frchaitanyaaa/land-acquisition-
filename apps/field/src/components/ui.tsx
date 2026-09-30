import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-teal-700 text-white active:bg-teal-800 disabled:bg-teal-700/50',
  secondary: 'border border-slate-300 bg-white text-slate-800 active:bg-slate-100 disabled:opacity-50',
  danger: 'bg-red-600 text-white active:bg-red-700 disabled:opacity-50',
  ghost: 'text-teal-800 active:bg-teal-50 disabled:opacity-50',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

const PILL: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-800',
  queued: 'bg-amber-100 text-amber-900',
  pending: 'bg-amber-100 text-amber-900',
  uploading: 'bg-sky-100 text-sky-900',
  synced: 'bg-emerald-100 text-emerald-900',
  uploaded: 'bg-emerald-100 text-emerald-900',
  rejected: 'bg-red-100 text-red-900',
  dropped: 'bg-slate-200 text-slate-700',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${PILL[status] ?? PILL.draft}`}>
      {status}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export const inputClass =
  'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm text-red-700">
      {children}
    </p>
  );
}
