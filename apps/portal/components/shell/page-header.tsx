import Link from 'next/link';
import type { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

/**
 * Page title block: UX4G Breadcrumb + h1 + subtitle + right-side actions.
 * One per page; the h1 is the page's only h1.
 */
export function PageHeader({
  title,
  subtitle,
  crumbs,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  crumbs?: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-xs">
      {crumbs && crumbs.length > 0 && (
        <nav className="ux4g-breadcrumb ux4g-breadcrumb-divider" aria-label="Breadcrumb">
          <ol className="ux4g-breadcrumb-list ux4g-d-flex ux4g-ai-center">
            {crumbs.map((c, i) => {
              const last = i === crumbs.length - 1;
              return (
                <li
                  key={c.label}
                  className={`ux4g-breadcrumb-item${last ? ' active' : ''}`}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.href && !last ? (
                    <Link href={c.href} className="ux4g-breadcrumb-link">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}
      <div className="ux4g-d-flex ux4g-ai-start ux4g-jc-between ux4g-gap-m ux4g-flex-wrap">
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-min-w-0">
          <h1 className="ux4g-heading-l-strong ux4g-text-neutral-primary">{title}</h1>
          {subtitle && <p className="ux4g-body-m-default ux4g-text-neutral-secondary">{subtitle}</p>}
        </div>
        {actions && <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-flex-wrap">{actions}</div>}
      </div>
    </div>
  );
}
