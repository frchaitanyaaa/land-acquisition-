import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

// UX4G classes, checked against ux4g-web-components/styles/ux4g.css 3.0.0. Every control is at least
// 48 px tall (min-h-12) — gloved, sun-lit, one-handed use in the field (A5).
const VARIANTS: Record<Variant, string> = {
  primary: 'ux4g-btn-primary',
  secondary: 'ux4g-btn-outline-primary',
  danger: 'ux4g-btn-danger',
  ghost: 'ux4g-btn-text-primary',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" {...props} className={`${VARIANTS[variant]} ux4g-btn-l min-h-12 ${className}`} />;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`ux4g-card ux4g-card-outline ux4g-card-vertical ux4g-p-m ${className}`}>{children}</div>;
}

const PILL: Record<string, 'neutral' | 'warning' | 'info' | 'success' | 'error'> = {
  draft: 'neutral',
  queued: 'warning',
  pending: 'warning',
  uploading: 'info',
  synced: 'success',
  uploaded: 'success',
  rejected: 'error',
  dropped: 'neutral',
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`ux4g-tag-tonal-${PILL[status] ?? 'neutral'} ux4g-tag-s uppercase`}>{status}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="ux4g-input-container ux4g-input-l ux4g-input-default block">
      <span className="ux4g-label-m-default">{label}</span>
      {children}
    </label>
  );
}

export const inputClass = 'ux4g-input block w-full min-h-12';

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="ux4g-alert ux4g-alert-error">
      {children}
    </p>
  );
}
