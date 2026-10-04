'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shell/page-header';
import { useMe } from '@/components/shell/shell-data';
import { EmptyState } from '@/components/ui/empty-state';
import { MockBadge } from '@/components/ui/badges';
import { SectionCard } from '@/components/ui/section-card';
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  advanceGrievance,
  demoNow,
  loadGrievances,
  nextStatus,
  resetMock,
  type GrievanceStatus,
  type MockGrievance,
} from '@/lib/mock-citizen';

type Tab = 'open' | 'dueSoon' | 'overdue' | 'closed';
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'open', label: 'Open' },
  { key: 'dueSoon', label: 'Due within 5 days' },
  { key: 'overdue', label: 'Past target' },
  { key: 'closed', label: 'Closed' },
];
const DAY_MS = 24 * 60 * 60 * 1000;

const ACTION_LABEL: Partial<Record<GrievanceStatus, string>> = {
  FILED: 'Assign to me',
  ASSIGNED: 'Start work',
  IN_PROGRESS: 'Send response',
  RESPONDED: 'Close',
};

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(iso));

/**
 * Officer grievance inbox — MOCK (lib/mock-citizen.ts): reads and updates the same browser-only
 * register the citizen portal writes to, so the demo can show file → assign → respond → close.
 */
export default function GrievancesPage() {
  const me = useMe();
  const [all, setAll] = useState<MockGrievance[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>('open');
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const reload = useCallback(async () => {
    setAll(await loadGrievances());
    setNow((await demoNow()).getTime());
  }, []);
  useEffect(() => void reload(), [reload]);

  const daysLeft = (g: MockGrievance) => (now === null ? 0 : Math.ceil((new Date(g.slaDueAt).getTime() - now) / DAY_MS));
  const rows = useMemo(() => {
    const isOpen = (g: MockGrievance) => g.status !== 'CLOSED';
    return all.filter((g) => {
      if (tab === 'closed') return !isOpen(g);
      if (!isOpen(g)) return false;
      const d = daysLeft(g);
      if (tab === 'dueSoon') return d >= 0 && d <= 5;
      if (tab === 'overdue') return d < 0;
      return true;
    });
    // daysLeft reads `now`, which is in the dependency list.
  }, [all, tab, now]);

  const count = (t: Tab) => {
    return all.filter((g) =>
      t === 'closed'
        ? g.status === 'CLOSED'
        : g.status !== 'CLOSED' && (t === 'open' || (t === 'dueSoon' ? daysLeft(g) >= 0 && daysLeft(g) <= 5 : daysLeft(g) < 0)),
    ).length;
  };

  async function act(g: MockGrievance) {
    const by = me.data?.activePost.designation ?? 'Officer';
    await advanceGrievance(g.trackingNo, note.trim(), by);
    setNote('');
    await reload();
  }

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Grievances"
        subtitle="Citizen grievances routed to your post, with a response target for each."
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Grievances' }]}
        actions={
          <button
            type="button"
            className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s"
            onClick={() => {
              resetMock();
              void reload();
            }}
          >
            Reset demo data
          </button>
        }
      />

      <div className="ux4g-alert ux4g-alert-warning" role="note">
        <MockBadge />
        <span>
          Demo only: this inbox runs in the browser to show the intended grievance flow. It shares data with the citizen
          portal in this browser; nothing is stored on the server and every record is synthetic.
        </span>
      </div>

      <div className="ux4g-tab ux4g-tab-underline ux4g-tab-md" role="tablist" aria-label="Grievance queues">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`ux4g-tab-item${tab === t.key ? ' ux4g-tab-item-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({count(t.key)})
          </button>
        ))}
      </div>

      <SectionCard title={TABS.find((t) => t.key === tab)?.label ?? ''} description="Click a row to open it.">
        {rows.length === 0 ? (
          <EmptyState icon="inbox" title="Nothing here" description="No grievances in this queue." />
        ) : (
          <div className="ux4g-o-x-auto">
            <table className="ux4g-table ux4g-table-m ux4g-w-100">
              <thead>
                <tr>
                  <th scope="col">Tracking no.</th>
                  <th scope="col">Category</th>
                  <th scope="col">Subject</th>
                  <th scope="col">Village / district</th>
                  <th scope="col">Filed</th>
                  <th scope="col">Response target</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const d = daysLeft(g);
                  const tone = g.status === 'CLOSED' ? 'neutral' : d < 0 ? 'error' : d <= 5 ? 'warning' : 'success';
                  return [
                    <tr key={g.trackingNo} className="ux4g-cursor-pointer" onClick={() => setOpen(open === g.trackingNo ? null : g.trackingNo)}>
                      <td className="ux4g-font-mono">{g.trackingNo}</td>
                      <td>{CATEGORY_LABEL[g.category]}</td>
                      <td>{g.subject}</td>
                      <td>
                        {g.village || '—'} · {g.district}
                      </td>
                      <td>{fmt(g.filedAt)}</td>
                      <td>
                        <span className={`ux4g-tag-tonal-${tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'error' ? 'error' : 'neutral'} ux4g-tag-s`}>
                          {g.status === 'CLOSED' ? 'Closed' : d < 0 ? `${-d} days past` : `${d} days left`}
                        </span>
                      </td>
                      <td>{STATUS_LABEL[g.status]}</td>
                    </tr>,
                    open === g.trackingNo && (
                      <tr key={`${g.trackingNo}-detail`}>
                        <td colSpan={7}>
                          <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-s ux4g-p-s">
                            <p className="ux4g-body-m-default">{g.body}</p>
                            <p className="ux4g-body-s-default ux4g-text-neutral-secondary">
                              Filed by {g.citizenName} ({g.phoneMasked}) · assigned to {g.assignedTo}
                            </p>
                            <ol className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs">
                              {g.events.map((ev, i) => (
                                <li key={i} className="ux4g-body-s-default">
                                  <strong>{STATUS_LABEL[ev.status]}</strong> · {fmt(ev.at)} · {ev.by} — {ev.note}
                                </li>
                              ))}
                            </ol>
                            {nextStatus(g.status) && (
                              <div className="ux4g-d-flex ux4g-gap-s ux4g-ai-end ux4g-flex-wrap">
                                <label className="ux4g-d-flex ux4g-flex-column ux4g-gap-2xs ux4g-flex-1">
                                  <span className="ux4g-label-m-strong">Note to the citizen (optional)</span>
                                  <input
                                    className="input"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </label>
                                <button
                                  type="button"
                                  className="ux4g-btn ux4g-btn-primary ux4g-btn-s"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void act(g);
                                  }}
                                >
                                  {ACTION_LABEL[g.status]}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
