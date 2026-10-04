'use client';

import { useState } from 'react';
import {
  AdvisoryBadge,
  EmptyState,
  KpiCard,
  MockBadge,
  NavyHero,
  PageHeader,
  SectionCard,
  StatusTag,
  type StatusKind,
} from '@/components/ui';

/**
 * Living reference for components/ui/README.md — every recipe rendered with sample (synthetic)
 * values. Not in the sidebar; open /ui-kit directly. Dark-ready (prefs.ts).
 */
const SAMPLE_STATUSES: Array<[StatusKind, string[]]> = [
  ['deadline', ['SAFE', 'DUE_SOON', 'BREACHED', 'SATISFIED']],
  ['entitlement', ['ASSESSED', 'DISBURSED', 'ACKNOWLEDGED', 'DEPOSITED_WITH_AUTHORITY', 'UNDER_PROTEST', 'DISPUTED']],
  ['parcel', ['PROPOSED', 'VERIFICATION_PENDING', 'VERIFIED', 'AWARDED', 'ACQUIRED_POSSESSED', 'TERMINATED']],
  ['chain', ['QUEUED', 'ANCHORED', 'MISMATCH', 'NOT_ANCHORED']],
  ['stage', ['NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'APPROVED', 'NULLIFIED']],
];

const ROWS = [
  { code: 'MH-PSX-2026-001', name: 'Pune–Satara Expressway Expansion', stage: 'S07_DECLARATION', status: 'DUE_SOON' },
  { code: 'MH-MAN-2026-009', name: 'Maan Metro Car Depot', stage: 'S02_SIA', status: 'BREACHED' },
  { code: 'KA-BGM-2026-003', name: 'Belagavi Ring Road', stage: 'S05_NOTIFICATION', status: 'SAFE' },
];

export default function UiKitPage() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('ALL');
  const rows = ROWS.filter(
    (r) => (filter === 'ALL' || r.status === filter) && `${r.code} ${r.name}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="UI kit"
        subtitle="The shared UX4G recipes (components/ui/README.md), rendered. Sample values only."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'UI kit' }]}
        actions={
          <button type="button" className="ux4g-btn ux4g-btn-primary ux4g-btn-s">
            Primary action
          </button>
        }
      />

      <NavyHero
        eyebrow="National command centre"
        title="Every statutory deadline, live"
        subtitle="Hero banner: eyebrow, title, subtitle, scope chip, controls, optional progress."
        scope="All India · 11 projects"
        controls={
          <button type="button" className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s">
            Refresh
          </button>
        }
        progress={{ value: 14.6, label: 'Area acquired of area affected' }}
      />

      <div className="ux4g-grid ux4g-grid-cols-1 ux4g-md-grid-cols-2 ux4g-lg-grid-cols-4 ux4g-gap-m">
        <KpiCard
          icon="landscape"
          label="Area notified"
          value="1,236.4"
          unit="ha"
          sub={{ text: '+12.1 ha this week' }}
        />
        <KpiCard
          icon="payments"
          label="Compensation paid"
          value="₹739 Cr"
          sub={{ text: '₹174.5 Cr unconfirmed', tone: 'warning' }}
        />
        <KpiCard
          icon="verified"
          label="Acknowledged"
          value="₹564.6 Cr"
          sub={{ text: '76% of paid', tone: 'success' }}
        />
        <KpiCard
          icon="alarm"
          label="Deadlines breached"
          value="3"
          sub={{ text: 'Legal consequence pending', tone: 'error' }}
        />
      </div>

      <SectionCard
        title="Status → tag colours"
        description="One map for every domain. Disbursed is amber on purpose: it is not received until acknowledged."
        actions={
          <>
            <MockBadge /> <AdvisoryBadge />
          </>
        }
      >
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-s">
          {SAMPLE_STATUSES.map(([kind, list]) => (
            <div key={kind} className="ux4g-d-flex ux4g-ai-center ux4g-gap-xs ux4g-flex-wrap">
              <span className="ux4g-label-m-strong ux4g-text-neutral-secondary ux4g-text-uppercase ux4g-min-w-96">
                {kind}
              </span>
              {list.map((s) => (
                <StatusTag key={s} kind={kind} status={s} />
              ))}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Data table with filter bar"
        description="Search + filter chips above a zebra table; the wrapper scrolls on phones."
      >
        <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-s">
          <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-s ux4g-flex-wrap">
            <label className="ux4g-input-container ux4g-input-m ux4g-input-default">
              <span className="ux4g-label-s-default">Search</span>
              <input type="search" placeholder="Code or name" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div
              className="ux4g-filter-chip-group ux4g-d-flex ux4g-gap-2xs ux4g-flex-wrap"
              role="group"
              aria-label="Deadline status"
            >
              {['ALL', 'BREACHED', 'DUE_SOON', 'SAFE'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ux4g-filter-chip-s${filter === s ? ' active' : ''}`}
                  aria-pressed={filter === s}
                  onClick={() => setFilter(s)}
                >
                  {s === 'ALL' ? 'All' : s.replace('_', ' ').toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="ux4g-o-x-auto">
            <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows ux4g-w-100">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Next deadline</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td>
                      <span className="ux4g-label-l-strong">{r.code}</span>
                      <br />
                      <span className="ux4g-body-xs-default ux4g-text-neutral-secondary">{r.name}</span>
                    </td>
                    <td className="ux4g-body-s-default">{r.stage}</td>
                    <td>
                      <StatusTag kind="deadline" status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <EmptyState
              icon="search_off"
              title="No matching projects"
              description="Clear the search or pick another filter."
            />
          )}
          <nav className="ux4g-pagination-wrapper" aria-label="Pagination">
            <div className="ux4g-pagination">
              <button type="button" className="ux4g-pagination-prev" aria-label="Previous page" disabled>
                ‹
              </button>
              <button type="button" className="active" aria-current="page">
                1
              </button>
              <button type="button">2</button>
              <button type="button" className="ux4g-pagination-next" aria-label="Next page">
                ›
              </button>
            </div>
          </nav>
        </div>
      </SectionCard>

      <SectionCard title="Empty state">
        <EmptyState
          icon="inbox"
          title="No returned files"
          description="Files returned to you with a reason code appear here."
          action={
            <button type="button" className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s">
              Go to proposals
            </button>
          }
        />
      </SectionCard>

      <div className="ux4g-alert ux4g-alert-warning" role="note">
        <span>Alert (warning): use for [VERIFY] notes — never present placeholder values as settled law.</span>
      </div>
    </div>
  );
}
