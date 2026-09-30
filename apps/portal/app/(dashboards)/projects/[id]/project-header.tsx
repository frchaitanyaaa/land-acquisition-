'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { DeadlineCountdown } from '@/components/deadline-countdown';
import { ApiProblem } from '@/lib/api';
import { useProject } from '@/lib/project-api';

const TABS = [
  { href: 'timeline', label: 'Timeline' },
  { href: 'parcels', label: 'Parcels' },
  { href: 'award', label: 'Award' },
  { href: 'families', label: 'Families & money' },
];

export function ProjectHeader({ projectId, children }: { projectId: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: project, error, isLoading } = useProject(projectId);

  if (error) {
    if (error instanceof ApiProblem && error.status === 401) {
      router.replace('/login');
      return null;
    }
    return <p className="text-red-700">Could not load this project.</p>;
  }
  if (isLoading || !project) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="border border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900">{project.name}</h1>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{project.code}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>{project.status}</span>
              {project.current_stage && (
                <>
                  <span aria-hidden className="text-slate-300">
                    ·
                  </span>
                  <span>{project.current_stage}</span>
                </>
              )}
              {project.rulePack && (
                <>
                  <span aria-hidden className="text-slate-300">
                    ·
                  </span>
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-800 ring-1 ring-inset ring-teal-200">
                    {project.rulePack.code}@{project.rulePack.version}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="min-w-64">
            <DeadlineCountdown deadline={project.nextDeadline} />
          </div>
        </div>

        {project.rulePack && project.rulePack.verify.length > 0 && (
          <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-semibold uppercase tracking-wide">Verify before presenting as settled</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {project.rulePack.verify.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}

        <nav className="mt-4 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => {
            const href = `/project/${projectId}/${t.href}`;
            const active = pathname === href;
            return (
              <Link
                key={t.href}
                href={href}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  active ? 'border-teal-700 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
