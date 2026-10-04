'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityBar } from './accessibility-bar';
import { Footer } from './footer';
import { LiveStreamProvider } from './live-stream';
import { useMe, useSelectedProject } from './shell-data';
import styles from './shell.module.css';
import { SidebarNav } from './sidebar';
import { ProjectSwitcher, TopBar } from './top-bar';

export type ShellVariant = 'full' | 'minimal';

/**
 * Client half of AppShell: accessibility bar, top bar, sidebar (desktop column / mobile drawer),
 * main region and footer. Layout uses UX4G's dashboard pattern (ux4g-dashboard-layout-container,
 * -sidebar, -main-content).
 */
export function ShellFrame({ variant, demoMode, children }: { variant: ShellVariant; demoMode: boolean; children: ReactNode }) {
  const body = (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-min-h-screen">
      <AccessibilityBar />
      {variant === 'full' ? <FullBody demoMode={demoMode}>{children}</FullBody> : <MinimalBody demoMode={demoMode}>{children}</MinimalBody>}
      <Footer />
    </div>
  );
  // The minimal (login) shell has no session yet, so it opens no SSE stream.
  return variant === 'full' ? <LiveStreamProvider>{body}</LiveStreamProvider> : body;
}

function MinimalBody({ demoMode, children }: { demoMode: boolean; children: ReactNode }) {
  return (
    <>
      <TopBar variant="minimal" demoMode={demoMode} />
      <main id="main-content" tabIndex={-1} className="ux4g-flex-1 ux4g-w-100 ux4g-px-m ux4g-py-xl">
        {children}
      </main>
    </>
  );
}

function FullBody({ demoMode, children }: { demoMode: boolean; children: ReactNode }) {
  const me = useMe();
  const [projectId] = useSelectedProject();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer on navigation and on Escape.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const post = me.data?.activePost;

  return (
    <>
      <TopBar variant="full" demoMode={demoMode} onOpenMenu={post ? () => setDrawerOpen(true) : undefined} />
      <div className="ux4g-dashboard-layout-container ux4g-flex-1">
        {post && (
          <aside className={`ux4g-dashboard-sidebar ${styles.sidebar}`} aria-label="Sidebar">
            <SidebarNav post={post} projectId={projectId} />
          </aside>
        )}
        <main id="main-content" tabIndex={-1} className={`ux4g-dashboard-main-content ${styles.main}`}>
          {children}
        </main>
      </div>

      {post && (
        // Mobile (<= 768 px): the same menu in a UX4G left drawer, opened from the top bar.
        <div
          className={`ux4g-drawer-overlay ux4g-z-50${drawerOpen ? ' ux4g-drawer-open' : ''}`}
          onClick={(e) => e.target === e.currentTarget && setDrawerOpen(false)}
          aria-hidden={!drawerOpen}
        >
          <div
            className={`ux4g-drawer ux4g-drawer-left ${styles.drawerPanel}${drawerOpen ? ' ux4g-drawer-open' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            // Closed drawers must not be reachable by keyboard.
            inert={!drawerOpen}
          >
            <div className="ux4g-drawer-header">
              <span className="ux4g-title-m-strong ux4g-text-primary">BhoomiSetu</span>
              <button
                type="button"
                className="ux4g-icon-btn ux4g-icon-btn-text-primary ux4g-icon-btn-m"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
              >
                <span className="ux4g-icon-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
            <div className="ux4g-drawer-body ux4g-d-flex ux4g-flex-column ux4g-gap-m">
              <ProjectSwitcher block />
              <SidebarNav post={post} projectId={projectId} onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
