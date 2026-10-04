'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { api, type Post } from '@/lib/api';
import { collectorKey, nationalKey, type CollectorDashboard, type NationalDashboard } from '@/lib/dashboards-api';
import { AskSlot } from './ask-slot';
import { NAV_GROUPS, QUICK_ACTIONS, resolveHref, visibleItems, type NavContext, type NavItem } from './nav-config';

/**
 * Breach counts for the sidebar badges — read from the dashboards' query cache only (`enabled:
 * false` never fetches), so the menu shows a count once that dashboard has loaded and costs nothing
 * otherwise.
 */
function useCachedCounts(): Record<string, number> {
  const national = useQuery({
    queryKey: nationalKey,
    queryFn: () => api<NationalDashboard>('/dashboards/national'),
    enabled: false,
  });
  const collector = useQuery({
    queryKey: collectorKey,
    queryFn: () => api<CollectorDashboard>('/dashboards/collector'),
    enabled: false,
  });
  const counts: Record<string, number> = {};
  if (national.data) counts.national = national.data.kpis.deadlines_breached;
  if (collector.data)
    counts.collector = collector.data.deadlineBoard.filter((d) => d.live_status === 'BREACHED').length;
  return counts;
}

/** Longest matching href wins, so two items sharing a path don't both light up. */
function activeKey(pathname: string, ctx: NavContext, role: string): string | null {
  let best: { key: string; len: number } | null = null;
  for (const group of NAV_GROUPS)
    for (const item of visibleItems(group, role)) {
      const href = !item.pending && resolveHref(item, ctx);
      if (href && (pathname === href || pathname.startsWith(`${href}/`)) && (!best || href.length > best.len))
        best = { key: item.key, len: href.length };
    }
  return best?.key ?? null;
}

export function SidebarNav({
  post,
  projectId,
  onNavigate,
}: {
  post: Post;
  projectId: string | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const counts = useCachedCounts();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ctx: NavContext = { post, projectId };
  const current = activeKey(pathname, ctx, post.role);

  return (
    <>
      <nav aria-label="Main" className="ux4g-dashboard-sidebar-nav">
        {NAV_GROUPS.map((group) => {
          // A post-scoped page the post has no target for (e.g. "State dashboard" for a national post) is left out
          // rather than shown disabled; project pages stay listed with "Select a project" until one is chosen.
          const items = visibleItems(group, post.role).filter((i) => i.projectScoped || resolveHref(i, ctx));
          if (items.length === 0) return null;
          const isCollapsed = collapsed[group.key] ?? false;
          const listId = `nav-group-${group.key}`;
          return (
            <div key={group.key} className="ux4g-w-100">
              <button
                type="button"
                className="ux4g-sidebar-nav-item ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-w-100 ux4g-px-s ux4g-py-xs ux4g-label-m-strong ux4g-text-neutral-secondary ux4g-text-uppercase"
                aria-expanded={!isCollapsed}
                aria-controls={listId}
                onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
              >
                {group.label}
                <span
                  className={`ux4g-icon-outlined ux4g-sidebar-tree-chevron ux4g-icon-neutral${isCollapsed ? ' is-collapsed' : ''}`}
                  aria-hidden="true"
                >
                  expand_less
                </span>
              </button>
              {!isCollapsed && (
                <ul id={listId} className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-mt-2xs">
                  {items.map((item) => (
                    <li key={item.key}>
                      <NavRow
                        item={item}
                        ctx={ctx}
                        active={current === item.key}
                        count={counts[item.key]}
                        onNavigate={onNavigate}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      <div className="ux4g-dashboard-sidebar-footer ux4g-d-flex ux4g-flex-column ux4g-gap-xs">
        <span className="ux4g-label-m-strong ux4g-text-neutral-secondary ux4g-text-uppercase ux4g-px-s">
          Quick actions
        </span>
        <Link
          href={QUICK_ACTIONS.newProject.href}
          onClick={onNavigate}
          className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s ux4g-w-100"
        >
          <span className="ux4g-icon-outlined" aria-hidden="true">
            {QUICK_ACTIONS.newProject.icon}
          </span>
          {QUICK_ACTIONS.newProject.label}
        </Link>
        <AskSlot onNavigate={onNavigate} />
      </div>
    </>
  );
}

function NavRow({
  item,
  ctx,
  active,
  count,
  onNavigate,
}: {
  item: NavItem;
  ctx: NavContext;
  active: boolean;
  count?: number;
  onNavigate?: () => void;
}) {
  const href = resolveHref(item, ctx);
  const needsProject = item.projectScoped && !ctx.projectId;
  const disabled = item.pending || !href;
  const description = needsProject ? 'Select a project in the top bar first' : item.description;

  const body = (
    <>
      <span className={`ux4g-icon-outlined ${active ? 'ux4g-text-primary' : 'ux4g-icon-neutral'}`} aria-hidden="true">
        {item.icon}
      </span>
      <span className="ux4g-d-flex ux4g-flex-column ux4g-min-w-0 ux4g-flex-1">
        <span className={`ux4g-label-l-strong ${active ? 'ux4g-text-primary' : 'ux4g-text-neutral-primary'}`}>
          {item.label}
        </span>
        <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">{description}</span>
      </span>
      {item.pending ? (
        <span className="ux4g-tag-tonal-neutral ux4g-tag-s">Soon</span>
      ) : count ? (
        <span className="ux4g-badge-digit-danger ux4g-badge-s" aria-label={`${count} breached`}>
          {count}
        </span>
      ) : null}
    </>
  );
  const cls = `ux4g-sidebar-nav-item ux4g-d-flex ux4g-ai-start ux4g-gap-s ux4g-px-s ux4g-py-xs ux4g-w-100${active ? ' active' : ''}`;

  if (disabled)
    return (
      <span className={`${cls} ux4g-opacity-60 ux4g-cursor-not-allowed`} aria-disabled="true">
        {body}
      </span>
    );
  if (item.external)
    return (
      <a href={href} className={cls} onClick={onNavigate}>
        {body}
      </a>
    );
  return (
    <Link href={href} className={cls} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
      {body}
    </Link>
  );
}
