'use client';

import { useInfiniteQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCard } from '@/components/ui/section-card';
import { api, ApiProblem } from '@/lib/api';

interface AuditRow {
  id: string;
  at: string;
  actor_designation: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changed_keys: string[];
  prev_hash: string;
  hash: string;
}

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(
    new Date(iso),
  );
const short = (h: string) => (h.length > 16 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h);

/**
 * Audit log (§11.6, G15): append-only, each row's hash covers the previous row's hash, so editing or
 * deleting any past row breaks the chain from that point. Shows which fields changed — never the
 * values (they may hold personal data). National oversight roles only (the API checks).
 */
export default function AuditLogPage() {
  const log = useInfiniteQuery({
    queryKey: ['audit', 'log'],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<{ data: AuditRow[]; nextCursor: string | null }>(
        `/audit/log?limit=50${pageParam ? `&before=${pageParam}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const verify = useMutation({
    mutationFn: () => api<{ checked: number; intact: boolean; firstBrokenId: string | null }>('/audit/verify'),
  });

  const rows = log.data?.pages.flatMap((p) => p.data) ?? [];
  const forbidden = log.error instanceof ApiProblem && log.error.status === 403;

  return (
    <div className="ux4g-d-flex ux4g-flex-column ux4g-gap-l">
      <PageHeader
        title="Audit log"
        subtitle="Every change, by which post, hash-chained so that no past entry can be altered or removed unnoticed."
        crumbs={[{ label: 'Trust', href: '/trust' }, { label: 'Audit log' }]}
        actions={
          <button
            type="button"
            className="ux4g-btn ux4g-btn-primary ux4g-btn-s"
            disabled={verify.isPending}
            onClick={() => verify.mutate()}
          >
            {verify.isPending ? 'Walking the chain…' : 'Verify audit chain'}
          </button>
        }
      />

      {verify.data && (
        <div
          role="status"
          className={`rounded-lg border-2 p-4 ${verify.data.intact ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : 'border-red-300 bg-red-50 text-red-950'}`}
        >
          <p className="text-lg font-bold">
            {verify.data.intact
              ? `✓ Chain intact: all ${verify.data.checked.toLocaleString('en-IN')} entries link correctly`
              : `✗ Chain broken at entry #${verify.data.firstBrokenId} (after ${verify.data.checked - 1} good entries)`}
          </p>
          <p className="mt-1 text-sm">
            Each entry stores the hash of the entry before it. The check recomputes every hash from the stored row.
          </p>
        </div>
      )}
      {verify.error && <p className="ux4g-text-error">{(verify.error as Error).message}</p>}

      <SectionCard
        title="Entries, newest first"
        description="Field names that changed are listed; values are not shown here because they may contain personal data."
      >
        {forbidden ? (
          <EmptyState
            title="Oversight posts only"
            description="The full audit log is visible to national oversight and system administrator posts."
          />
        ) : log.isLoading ? (
          <p className="ux4g-body-s-default">Loading…</p>
        ) : log.error ? (
          <p className="ux4g-text-error">{(log.error as Error).message}</p>
        ) : rows.length === 0 ? (
          <EmptyState title="No entries" description="Nothing has been recorded yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">When (IST)</th>
                  <th className="py-2 pr-3">Post</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Record</th>
                  <th className="py-2 pr-3">Fields changed</th>
                  <th className="py-2">Hash ← previous</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 tabular-nums text-slate-500">{r.id}</td>
                    <td className="py-2 pr-3 text-xs">{when(r.at)}</td>
                    <td className="py-2 pr-3">
                      {r.actor_designation ?? <span className="text-slate-500">System / public</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{r.action}</td>
                    <td className="py-2 pr-3 text-xs">
                      {r.entity_type}
                      {r.entity_id && (
                        <span className="block font-mono text-slate-500">{r.entity_id.slice(0, 8)}…</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {r.changed_keys.length ? r.changed_keys.join(', ') : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="py-2 font-mono text-xs">
                      {short(r.hash)}
                      <span className="block text-slate-400">← {short(r.prev_hash)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {log.hasNextPage && (
              <button
                type="button"
                className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s mt-3"
                disabled={log.isFetchingNextPage}
                onClick={() => void log.fetchNextPage()}
              >
                {log.isFetchingNextPage ? 'Loading…' : 'Load older entries'}
              </button>
            )}
          </div>
        )}
      </SectionCard>
      <p className="text-sm text-slate-600">
        Records anchored on the blockchain are checked in the{' '}
        <Link href="/trust" className="underline">
          Trust center
        </Link>
        .
      </p>
    </div>
  );
}
