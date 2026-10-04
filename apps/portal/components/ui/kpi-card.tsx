import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Tone } from './status-tag';

const TEXT_TONE: Record<Tone, string> = {
  neutral: 'ux4g-text-neutral-secondary',
  primary: 'ux4g-text-primary',
  success: 'ux4g-text-success',
  warning: 'ux4g-text-warning',
  error: 'ux4g-text-error',
  info: 'ux4g-text-info',
};

/**
 * KPI card (C1 recipe): icon, label, big number, unit, and an optional coloured sub-metric line
 * (e.g. "₹174.5 Cr unconfirmed" in warning). Values arrive pre-formatted — use formatCrore /
 * formatArea / formatPct; never format money here (G9).
 */
export function KpiCard({
  icon,
  label,
  value,
  unit,
  sub,
  href,
}: {
  /** Material icon name. */
  icon: string;
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: { text: ReactNode; tone?: Tone };
  /** Makes the whole card a link (drill-down). */
  href?: string;
}) {
  const body = (
    <div className="ux4g-card-body ux4g-d-flex ux4g-ai-start ux4g-gap-s">
      <span
        className="ux4g-d-inline-flex ux4g-ai-center ux4g-jc-center ux4g-bg-primary-soft ux4g-radius-full ux4g-p-xs"
        aria-hidden="true"
      >
        <span className="ux4g-icon-outlined ux4g-text-primary">{icon}</span>
      </span>
      <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-min-w-0">
        <span className="ux4g-label-l-default ux4g-text-neutral-secondary">{label}</span>
        <span className="ux4g-d-flex ux4g-ai-center ux4g-gap-2xs ux4g-flex-wrap">
          <span className="ux4g-heading-l-strong ux4g-text-neutral-primary">{value}</span>
          {unit && <span className="ux4g-body-s-default ux4g-text-neutral-secondary">{unit}</span>}
        </span>
        {sub && <span className={`ux4g-body-xs-strong ${TEXT_TONE[sub.tone ?? 'neutral']}`}>{sub.text}</span>}
      </div>
    </div>
  );
  const cls = 'ux4g-card ux4g-card-outline ux4g-card-vertical ux4g-h-100';
  return href ? (
    <Link href={href} className={`${cls} ux4g-text-no-underline`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
