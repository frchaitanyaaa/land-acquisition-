import type { ReactNode } from 'react';

/**
 * Dark navy hero banner at the top of dashboards and the project workspace (C2/C3).
 * Surface = ux4g-bg-primary-strong (navy in light; UX4G re-points it to a light navy in dark mode,
 * where the text flips to inverse automatically via ux4g-text-neutral-inverse).
 *
 * `progress` is 0–100 and rendered with the UX4G Progress Indicator; pass its label too.
 */
export function NavyHero({
  eyebrow,
  title,
  subtitle,
  scope,
  controls,
  progress,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  scope?: ReactNode;
  controls?: ReactNode;
  progress?: { value: number; label: string };
  children?: ReactNode;
}) {
  const pct = progress ? Math.max(0, Math.min(100, progress.value)) : 0;
  return (
    <section className="ux4g-bg-primary-strong ux4g-text-neutral-inverse ux4g-radius-l ux4g-p-l ux4g-d-flex ux4g-flex-column ux4g-gap-m">
      <div className="ux4g-d-flex ux4g-ai-start ux4g-jc-between ux4g-gap-m ux4g-flex-wrap">
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-xs ux4g-min-w-0">
          {eyebrow && <span className="ux4g-label-m-strong ux4g-text-uppercase ux4g-opacity-80">{eyebrow}</span>}
          <h1 className="ux4g-heading-l-strong">{title}</h1>
          {subtitle && <p className="ux4g-body-m-default ux4g-opacity-90">{subtitle}</p>}
          {scope && (
            <span className="ux4g-d-inline-flex">
              <span className="ux4g-tag-tonal-neutral ux4g-tag-s">{scope}</span>
            </span>
          )}
        </div>
        {controls && <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-flex-wrap">{controls}</div>}
      </div>
      {progress && (
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs">
          <div className="ux4g-d-flex ux4g-jc-between ux4g-label-m-default">
            <span>{progress.label}</span>
            <span>{pct.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%</span>
          </div>
          <div
            className="ux4g-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={progress.label}
          >
            <div className="ux4g-progress-bar-track">
              <div className="ux4g-progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
