import type { ReactNode } from 'react';

/** UX4G Empty State: icon, title, one line of help, optional action (a button or link). */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="ux4g-empty-state ux4g-w-100 ux4g-p-l" role="status">
      <span className="ux4g-icon-outlined ux4g-empty-state-icon ux4g-icon-neutral" aria-hidden="true">
        {icon}
      </span>
      <p className="ux4g-title-s-strong ux4g-text-neutral-primary">{title}</p>
      {description && <p className="ux4g-body-s-default ux4g-text-neutral-secondary">{description}</p>}
      {action}
    </div>
  );
}
