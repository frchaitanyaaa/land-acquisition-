import type { ReactNode } from 'react';

/**
 * Bounded content section: UX4G Card (outline, vertical) with a header row — title (Title scale,
 * not a page heading), optional description and right-side actions — and a body.
 * `id` lets breadcrumbs / "Inspect stage" buttons scroll to it.
 */
export function SectionCard({
  title,
  description,
  actions,
  id,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} className="ux4g-card ux4g-card-outline ux4g-card-vertical" aria-labelledby={headingId}>
      <div className="ux4g-card-header ux4g-d-flex ux4g-ai-start ux4g-jc-between ux4g-gap-m ux4g-flex-wrap">
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-min-w-0">
          <h2 id={headingId} className="ux4g-card-title ux4g-title-s-strong">
            {title}
          </h2>
          {description && <p className="ux4g-body-s-default ux4g-text-neutral-secondary">{description}</p>}
        </div>
        {actions && <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-flex-wrap">{actions}</div>}
      </div>
      <div className="ux4g-card-body">{children}</div>
    </section>
  );
}
