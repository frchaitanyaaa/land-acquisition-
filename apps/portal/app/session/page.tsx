'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { useLogout, useMe, useSwitchPost } from '@/components/shell/shell-data';
import { jurisdictionOf } from '@/components/shell/top-bar';
import { ApiProblem } from '@/lib/api';
import { homeFor } from '@/lib/roles';

/**
 * Who am I, and through which post? Switching post changes what the API returns immediately:
 * RLS scope, redaction and role checks all follow the active post (G19, §34 beat 7).
 * First screen restyled with UX4G end to end — it is listed in DARK_READY_ROUTES.
 */
export default function SessionPage() {
  const router = useRouter();
  const me = useMe();
  const switchPost = useSwitchPost();
  const logout = useLogout();

  useEffect(() => {
    if (me.error instanceof ApiProblem && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);

  if (me.isError && !(me.error instanceof ApiProblem && me.error.status === 401))
    return (
      <div className="ux4g-alert ux4g-alert-error" role="alert">
        <span>Could not load your session.</span>
      </div>
    );
  if (!me.data)
    return (
      <p className="ux4g-body-m-default ux4g-text-neutral-secondary" role="status">
        Loading…
      </p>
    );

  const { user, posts, activePost } = me.data;

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title={user.fullName}
        subtitle={user.email}
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Session and posts' }]}
        actions={
          <button
            type="button"
            className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s"
            onClick={() => logout.mutate()}
          >
            <span className="ux4g-icon-outlined" aria-hidden="true">
              logout
            </span>
            Sign out
          </button>
        }
      />

      <section className="ux4g-card ux4g-card-outline ux4g-card-vertical" aria-labelledby="posts-heading">
        <div className="ux4g-card-header">
          <h2 id="posts-heading" className="ux4g-title-s-strong">
            Acting as
          </h2>
          <p className="ux4g-body-s-default ux4g-text-neutral-secondary">
            Roles attach to posts, not people (G19). Every action records both you and the post you act through.
          </p>
        </div>
        <div className="ux4g-card-body">
          <ul className="ux4g-d-flex ux4g-flex-column ux4g-gap-xs">
            {posts.map((p) => {
              const active = p.id === activePost.id;
              return (
                <li
                  key={p.id}
                  className={`ux4g-d-flex ux4g-ai-center ux4g-jc-between ux4g-gap-m ux4g-flex-wrap ux4g-p-s ux4g-radius-m ${active ? 'ux4g-bg-primary-soft' : 'ux4g-bg-neutral-soft'}`}
                >
                  <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-min-w-0">
                    <span className="ux4g-label-l-strong">{p.designation}</span>
                    <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">
                      {p.role} · {jurisdictionOf(p)}
                    </span>
                  </div>
                  {active ? (
                    <span className="ux4g-tag-filled-success ux4g-tag-s">Active</span>
                  ) : (
                    <button
                      type="button"
                      className="ux4g-btn ux4g-btn-primary ux4g-btn-s"
                      disabled={switchPost.isPending}
                      onClick={() => switchPost.mutate(p.id)}
                    >
                      Switch to this post
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <div className="ux4g-d-flex ux4g-flex-wrap ux4g-gap-s">
        {homeFor(activePost) !== '/session' && (
          <Link href={homeFor(activePost)} className="ux4g-btn ux4g-btn-primary ux4g-btn-s">
            Open my dashboard
          </Link>
        )}
        {/* Beat 7: the citizen portal calls the API without cookies, so it shows only what public_* views allow. */}
        <Link href="/portal" className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s">
          View the citizen portal
        </Link>
      </div>
    </div>
  );
}
