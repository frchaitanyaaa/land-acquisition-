'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import type { ProjectListRow } from '@/components/shell/shell-data';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { StatusTag } from '@/components/ui/status-tag';
import { api } from '@/lib/api';

const GROUPS: Array<{ title: string; description: string; statuses: string[] }> = [
  { title: 'Drafts', description: 'Being prepared; not yet submitted to the Collector.', statuses: ['DRAFT'] },
  { title: 'Submitted', description: 'Awaiting scrutiny and acceptance (stage S01).', statuses: ['SUBMITTED'] },
  { title: 'Accepted and in progress', description: 'Accepted proposals moving through the statutory stages.', statuses: ['ACTIVE', 'ON_HOLD'] },
  {
    title: 'Closed or stopped',
    description: 'Completed, terminated, denotified, abandoned or lapsed.',
    statuses: ['CLOSED', 'TERMINATED', 'DENOTIFIED', 'ABANDONED', 'LAPSED'],
  },
];

const stage = (s: string | null) => (s ? s.replace(/^S\d+_/, '').replace(/_/g, ' ').toLowerCase() : '—');

/** Proposals (§14): every project in the post's scope by status; a requiring body sees only its own (RLS). */
export default function ProposalsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['projects', 'proposals'],
    queryFn: () => api<ProjectListRow[]>('/projects?limit=500'),
  });

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Proposals"
        subtitle="Land acquisition proposals in your scope, from draft to acceptance and beyond."
        crumbs={[{ label: 'Overview' }, { label: 'Proposals' }]}
        actions={
          <Link href="/projects/new" className="ux4g-btn ux4g-btn-primary ux4g-btn-s">
            Register new project
          </Link>
        }
      />
      {isLoading ? (
        <p className="text-sm text-slate-600">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-700">{(error as Error).message}</p>
      ) : (
        GROUPS.map((g) => {
          const rows = (data ?? []).filter((p) => g.statuses.includes(p.status));
          return (
            <SectionCard key={g.title} title={`${g.title} (${rows.length})`} description={g.description}>
              {rows.length === 0 ? (
                <EmptyState title="None" description="No proposals in this group." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {rows.map((p) => (
                    <li key={p.project_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <Link href={`/project/${p.project_id}/timeline`} className="font-medium text-teal-800 hover:underline">
                        {p.code} · {p.name}
                      </Link>
                      <span className="flex items-center gap-2 text-slate-600">
                        Stage: {stage(p.current_stage)} <StatusTag kind="project" status={p.status} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          );
        })
      )}
    </div>
  );
}
