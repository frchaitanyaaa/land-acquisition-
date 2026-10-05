import type { ReactNode } from 'react';

const ACCENT = {
  navy: { rule: 'bg-[#1f3c8f]', icon: '#1f3c8f', bar: 'bg-[#1f3c8f]' },
  saffron: { rule: 'bg-[#ff9933]', icon: '#c2650a', bar: 'bg-[#ff9933]' },
  green: { rule: 'bg-[#138808]', icon: '#138808', bar: 'bg-[#138808]' },
  slate: { rule: 'bg-slate-300', icon: '#64748b', bar: 'bg-slate-500' },
} as const;

/**
 * One KPI. `accent` groups tiles by meaning (land navy, money saffron, people green); `progress` (0–100) draws a
 * thin bar under percentage KPIs. Icons are UX4G Material Icons names.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
  icon,
  accent = 'slate',
  progress,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'critical';
  icon?: string;
  accent?: keyof typeof ACCENT;
  progress?: number | null;
}) {
  const a = ACCENT[accent];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 pb-3 pt-4">
      <span className={`absolute inset-x-0 top-0 h-1 ${a.rule}`} aria-hidden />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {icon && (
          <span className="ux4g-icon-outlined text-xl" style={{ color: a.icon }} aria-hidden>
            {icon}
          </span>
        )}
      </div>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${tone === 'critical' ? 'text-red-700' : 'text-slate-900'}`}
      >
        {value}
      </p>
      {progress != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
          <div className={`h-full rounded-full ${a.bar}`} style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
