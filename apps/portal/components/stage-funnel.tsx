import Link from 'next/link';
import type { ProjectMapRow } from '@/lib/dashboards-api';

/** Display order only (stage codes come from the rule packs); unknown codes sort after these. */
const ORDER = [
  'S01_PROPOSAL',
  'S02_SIA',
  'S03_APPRAISAL',
  'S04_CONSENT',
  'S05_NOTIFICATION',
  'S06_RNR_SCHEME',
  'S07_DECLARATION',
  'S08_AWARD',
  'S09_PAYMENT_POSSESSION',
  'S10_POST_ACQUISITION',
  'NH_PROPOSAL',
  'NH_3A_INTENT',
  'NH_3C_OBJECTIONS',
  'NH_3D_DECLARATION',
  'NH_3G_AMOUNT',
  'NH_3H_DEPOSIT_PAYMENT',
  'NH_POSSESSION',
  'NH_POST',
];

/** "S07_DECLARATION" → "S07 · Declaration"; "NH_3A_INTENT" → "NH · 3A intent". */
function shortLabel(code: string) {
  const [prefix = '', ...rest] = code.split('_');
  const words = rest
    .map((w) => (w === 'SIA' ? 'SIA' : w === 'RNR' ? 'R&R' : /^\d+[A-Z]$/.test(w) ? w : w.toLowerCase()))
    .join(' ');
  return `${prefix} · ${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

/**
 * How many projects sit at each stage — a CSS bar chart from the dashboard's project list (no chart library).
 * With `linkTo`, each bar opens the projects pipeline filtered to that stage (national / state posts only).
 */
export function StageFunnel({ projects, linkTo }: { projects: ProjectMapRow[]; linkTo?: (stage: string) => string }) {
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(p.current_stage, (counts.get(p.current_stage) ?? 0) + 1);
  const rank = (c: string) => (ORDER.indexOf(c) === -1 ? ORDER.length : ORDER.indexOf(c));
  const rows = [...counts.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  const max = Math.max(1, ...rows.map(([, n]) => n));
  if (rows.length === 0) return <p className="text-sm text-slate-500">No projects in scope.</p>;

  return (
    <ul className="space-y-2">
      {rows.map(([code, n]) => {
        const body = (
          <>
            <span className="w-40 shrink-0 truncate text-sm text-slate-700 sm:w-48">{shortLabel(code)}</span>
            <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
              <span
                className={`absolute inset-y-0 left-0 rounded-md ${code.startsWith('NH_') ? 'bg-[#ff9933]/80' : 'bg-[#1f3c8f]/85'}`}
                style={{ width: `${(n / max) * 100}%` }}
              />
            </span>
            <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">{n}</span>
          </>
        );
        return (
          <li key={code}>
            {linkTo ? (
              <Link
                href={linkTo(code)}
                className="flex items-center gap-3 rounded-md px-1 py-0.5 hover:bg-slate-50"
                title={`See the ${n} project${n === 1 ? '' : 's'} at this stage`}
              >
                {body}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-1 py-0.5">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
