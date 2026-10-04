'use client';

import { formatDateTime } from '@bhoomisetu/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { Me, Post } from '@/lib/api';
import { useLiveStream } from './live-stream';
import {
  useLogout,
  useMarkRead,
  useMe,
  useNotifications,
  useProjectList,
  useSelectedProject,
  useSwitchPost,
  type NotificationRow,
} from './shell-data';
import styles from './shell.module.css';
import { useDisclosure } from './use-disclosure';

/** Post jurisdiction as one line: "District 521 · Collector". Codes are LGD codes. */
export function jurisdictionOf(post: Post): string {
  if (post.level === 'DISTRICT' && post.districtCode) return `District ${post.districtCode}`;
  if (post.level === 'STATE' && post.stateCode) return `State ${post.stateCode}`;
  if (post.level === 'PROJECT') return 'Project post';
  return 'National';
}

export function TopBar({
  variant,
  demoMode,
  onOpenMenu,
}: {
  variant: 'full' | 'minimal';
  demoMode: boolean;
  onOpenMenu?: () => void;
}) {
  const full = variant === 'full';
  const me = useMe();
  const signedIn = full && !!me.data;

  return (
    <header>
      {/* Decorative national tricolour strip (00-shared-context.md identity). No State Emblem. */}
      <div className={styles.tricolour} aria-hidden="true" />
      <nav className="ux4g-navbar ux4g-px-m" aria-label="Top">
        <div className="ux4g-navbar-wrap ux4g-flex-wrap">
          <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-s ux4g-min-w-0">
            {full && onOpenMenu && (
              <button
                type="button"
                className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-m ux4g-md-d-none"
                aria-label="Open menu"
                onClick={onOpenMenu}
              >
                <span className="ux4g-icon-outlined" aria-hidden="true">
                  menu
                </span>
              </button>
            )}
            <Link
              href={signedIn ? '/national' : '/'}
              className="ux4g-d-flex ux4g-flex-column ux4g-min-w-0 ux4g-text-no-underline"
            >
              <span className="ux4g-heading-s-strong ux4g-text-primary">BhoomiSetu</span>
              <span className="ux4g-body-xs-default ux4g-text-neutral-secondary ux4g-d-none ux4g-md-d-block">
                Ministry of Rural Development · Prototype for SIH 26016
              </span>
            </Link>
            {demoMode && (
              // §9 / G18: every record is synthetic; the badge stays in every shell.
              <span className="ux4g-tag-filled-warning ux4g-tag-s" title="All records are synthetic demo data">
                DEMO DATA
              </span>
            )}
          </div>

          {full && (
            <div className="ux4g-navbar-right ux4g-ai-center ux4g-gap-xs ux4g-ml-auto">
              {signedIn && (
                <span className="ux4g-d-none ux4g-md-d-flex">
                  <ProjectSwitcher />
                </span>
              )}
              <LiveDot />
              {signedIn && <Bell />}
              {me.data ? (
                <UserMenu me={me.data} />
              ) : (
                me.isError && (
                  <Link href="/login" className="ux4g-btn ux4g-btn-primary ux4g-btn-s">
                    Sign in
                  </Link>
                )
              )}
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

/** Dropdown of the projects in the viewer's scope (RLS decides the list). */
export function ProjectSwitcher({ block = false }: { block?: boolean }) {
  const { data: projects } = useProjectList(true);
  const [selected, select] = useSelectedProject();
  const d = useDisclosure();
  const current = projects?.find((p) => p.project_id === selected);

  return (
    <div
      ref={d.ref}
      className={`ux4g-dropdown ux4g-dropdown-button ux4g-dropdown-s${d.open ? ' is-open' : ''}${block ? ' ux4g-w-100' : ''}`}
      style={{ ['--ux4g-dropdown-menu-width' as string]: block ? '100%' : '22rem' }}
    >
      <button
        ref={d.triggerRef}
        type="button"
        className={`ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s${block ? ' ux4g-w-100' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={d.open}
        onClick={d.toggle}
      >
        <span className="ux4g-icon-outlined" aria-hidden="true">
          work
        </span>
        <span className="ux4g-line-clamp-1">{current ? `${current.code}` : 'Select project'}</span>
        <span className="ux4g-icon-outlined" aria-hidden="true">
          expand_more
        </span>
      </button>
      <ul className="ux4g-dropdown-menu ux4g-max-h-384 ux4g-o-y-auto ux4g-z-50" role="listbox" aria-label="Projects">
        {(projects ?? []).map((p) => (
          <li key={p.project_id} role="option" aria-selected={p.project_id === selected}>
            <button
              type="button"
              className={`ux4g-dropdown-option ux4g-d-flex ux4g-flex-column ux4g-ai-start ux4g-text-start${p.project_id === selected ? ' ux4g-bg-primary-soft' : ''}`}
              onClick={() => {
                select(p.project_id);
                d.close(true);
              }}
            >
              <span className="ux4g-label-l-strong ux4g-text-neutral-primary">{p.code}</span>
              <span className="ux4g-body-xs-default ux4g-text-neutral-secondary ux4g-line-clamp-1">{p.name}</span>
            </button>
          </li>
        ))}
        {projects?.length === 0 && (
          <li className="ux4g-dropdown-option ux4g-body-s-default">No projects in your scope</li>
        )}
        {selected && (
          <li>
            <button
              type="button"
              className="ux4g-dropdown-option ux4g-body-s-default ux4g-text-neutral-secondary ux4g-text-start"
              onClick={() => {
                select(null);
                d.close(true);
              }}
            >
              Clear selection
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}

function LiveDot() {
  const live = useLiveStream();
  const on = !!live?.connected;
  return (
    <span
      className="ux4g-d-inline-flex ux4g-ai-center ux4g-gap-2xs"
      title={on ? 'Live updates connected' : 'Live updates not connected'}
      role="status"
    >
      <span className={on ? 'ux4g-badge-dot-success' : 'ux4g-badge-dot-neutral'} aria-hidden="true" />
      <span className="ux4g-label-m-default ux4g-text-neutral-secondary">{on ? 'Live' : 'Offline'}</span>
    </span>
  );
}

type NotifFilter = 'all' | 'unread' | 'deadlines' | 'documents';
const FILTERS: Array<[NotifFilter, string]> = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['deadlines', 'Deadlines'],
  ['documents', 'Documents'],
];
const isDeadline = (n: NotificationRow) => n.trigger.startsWith('DEADLINE') || n.trigger === 'ESCALATED';
const isDocument = (n: NotificationRow) =>
  (n.entityType ?? '').toLowerCase().includes('document') ||
  n.trigger.includes('DOCUMENT') ||
  n.trigger.includes('ATTEST');
const SEVERITY_TAG: Record<NotificationRow['severity'], string> = {
  info: 'ux4g-tag-tonal-info',
  warn: 'ux4g-tag-tonal-warning',
  critical: 'ux4g-tag-tonal-error',
};

function Bell() {
  const live = useLiveStream();
  const d = useDisclosure();
  const router = useRouter();
  const [filter, setFilter] = useState<NotifFilter>('all');
  const list = useNotifications(d.open, live?.unread ?? null);
  // The SSE count arrives every few seconds; until then use the list's own count if loaded.
  const unread = live?.unread ?? list.data?.unread ?? null;
  const markRead = useMarkRead();

  const rows = useMemo(() => {
    const all = list.data?.items ?? [];
    if (filter === 'unread') return all.filter((n) => !n.readAt);
    if (filter === 'deadlines') return all.filter(isDeadline);
    if (filter === 'documents') return all.filter(isDocument);
    return all;
  }, [list.data, filter]);

  function openRow(n: NotificationRow) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.deepLink) {
      d.close();
      router.push(n.deepLink);
    }
  }

  return (
    <div ref={d.ref} className="ux4g-relative">
      <button
        ref={d.triggerRef}
        type="button"
        className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-m ux4g-relative"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={d.open}
        aria-haspopup="dialog"
        onClick={d.toggle}
      >
        <span className="ux4g-icon-outlined" aria-hidden="true">
          notifications
        </span>
        {!!unread && (
          <span className="ux4g-badge-digit-danger ux4g-badge-s ux4g-absolute ux4g-top-0 ux4g-end-0" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {d.open && (
        <div
          className={`ux4g-popover ux4g-popover-bottom-end show ux4g-top-100 ux4g-end-0 ${styles.popoverPanel}`}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="ux4g-popover-header ux4g-w-100">
            <div className="ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-w-100">
              <h2 className="ux4g-popover-title ux4g-title-s-strong">Notifications</h2>
              <button
                type="button"
                className="ux4g-btn ux4g-btn-text-primary ux4g-btn-xs"
                disabled={!list.data?.unread || markRead.isPending}
                onClick={() => markRead.mutate('all')}
              >
                Mark all read
              </button>
            </div>
            <div
              className="ux4g-filter-chip-group ux4g-d-flex ux4g-flex-wrap ux4g-gap-2xs"
              role="group"
              aria-label="Filter notifications"
            >
              {FILTERS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`ux4g-filter-chip-s${filter === key ? ' active' : ''}`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="ux4g-popover-body ux4g-w-100 ux4g-max-h-384 ux4g-o-y-auto ux4g-p-none">
            {list.isLoading ? (
              <p className="ux4g-body-s-default ux4g-text-neutral-secondary ux4g-p-s">Loading…</p>
            ) : rows.length === 0 ? (
              <div className="ux4g-empty-state ux4g-w-100 ux4g-p-l">
                <span className="ux4g-icon-outlined ux4g-empty-state-icon ux4g-icon-neutral" aria-hidden="true">
                  notifications_none
                </span>
                <p className="ux4g-title-s-strong">Nothing here</p>
                <p className="ux4g-body-s-default ux4g-text-neutral-secondary">
                  {filter === 'all' ? 'No notifications for this post yet.' : 'No notifications match this filter.'}
                </p>
              </div>
            ) : (
              <ul className="ux4g-w-100">
                {rows.map((n) => (
                  <li key={n.id} className="ux4g-notification-item ux4g-px-s">
                    <span
                      className={`ux4g-badge-dot-${n.readAt ? 'neutral' : 'primary'} ux4g-mt-xs`}
                      aria-hidden="true"
                    />
                    <div className="ux4g-notification-content ux4g-min-w-0">
                      <div className="ux4g-notification-top-row ux4g-gap-xs">
                        <button
                          type="button"
                          className="ux4g-text-link-m ux4g-text-start ux4g-label-l-strong"
                          onClick={() => openRow(n)}
                        >
                          {n.title}
                        </button>
                        <span className={`${SEVERITY_TAG[n.severity]} ux4g-tag-s`}>{n.severity}</span>
                      </div>
                      {n.body && (
                        <p className="ux4g-body-xs-default ux4g-text-neutral-secondary ux4g-line-clamp-2">{n.body}</p>
                      )}
                      <div className="ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-xs">
                        <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">
                          {formatDateTime(n.createdAt)}
                        </span>
                        {!n.readAt && (
                          <button
                            type="button"
                            className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-xs"
                            onClick={() => markRead.mutate(n.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ me }: { me: Me }) {
  const d = useDisclosure();
  const switchPost = useSwitchPost();
  const logout = useLogout();
  const { activePost } = me;
  const others = me.posts.filter((p) => p.id !== activePost.id);

  return (
    <div
      ref={d.ref}
      className={`ux4g-dropdown ux4g-dropdown-button ux4g-dropdown-s${d.open ? ' is-open' : ''}`}
      style={{ ['--ux4g-dropdown-menu-width' as string]: '20rem' }}
    >
      <button
        ref={d.triggerRef}
        type="button"
        className="ux4g-btn ux4g-btn-text-neutral ux4g-btn-s"
        aria-haspopup="menu"
        aria-expanded={d.open}
        onClick={d.toggle}
      >
        <span className="ux4g-icon-outlined" aria-hidden="true">
          account_circle
        </span>
        <span className="ux4g-d-none ux4g-md-d-flex ux4g-flex-column ux4g-ai-start">
          <span className="ux4g-label-l-strong">{me.user.fullName}</span>
          <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">
            {activePost.designation} · {jurisdictionOf(activePost)}
          </span>
        </span>
        <span className="ux4g-icon-outlined" aria-hidden="true">
          expand_more
        </span>
      </button>
      <div className="ux4g-dropdown-menu ux4g-z-50 ux4g-start-auto ux4g-end-0" role="menu" aria-label="Account">
        <div className="ux4g-px-s ux4g-py-xs">
          <p className="ux4g-label-l-strong">{me.user.fullName}</p>
          <p className="ux4g-body-xs-default ux4g-text-neutral-secondary">
            Acting as {activePost.designation} · {activePost.role} · {jurisdictionOf(activePost)}
          </p>
        </div>
        {others.length > 0 && (
          <>
            <hr className="ux4g-divider-horizontal" />
            <p className="ux4g-label-m-strong ux4g-text-neutral-secondary ux4g-text-uppercase ux4g-px-s ux4g-pt-xs">
              Switch post
            </p>
            {others.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="ux4g-dropdown-option ux4g-d-flex ux4g-flex-column ux4g-ai-start ux4g-text-start"
                disabled={switchPost.isPending}
                onClick={() => {
                  switchPost.mutate(p.id);
                  d.close(true);
                }}
              >
                <span className="ux4g-label-l-default ux4g-text-neutral-primary">{p.designation}</span>
                <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">
                  {p.role} · {jurisdictionOf(p)}
                </span>
              </button>
            ))}
          </>
        )}
        <hr className="ux4g-divider-horizontal" />
        <Link
          href="/session"
          role="menuitem"
          className="ux4g-dropdown-option ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-body-s-default"
          onClick={() => d.close()}
        >
          <span className="ux4g-icon-outlined ux4g-icon-neutral" aria-hidden="true">
            badge
          </span>
          Session and posts
        </Link>
        <button
          type="button"
          role="menuitem"
          className="ux4g-dropdown-option ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-body-s-default ux4g-text-start"
          onClick={() => logout.mutate()}
        >
          <span className="ux4g-icon-outlined ux4g-icon-neutral" aria-hidden="true">
            logout
          </span>
          Sign out
        </button>
      </div>
    </div>
  );
}
