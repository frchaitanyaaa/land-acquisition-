'use client';

import Link from 'next/link';
import { useState } from 'react';

/**
 * Evaluator sign-in sheet for the landing page. Rendered only when DEMO_MODE=true (the page checks):
 * every account is a synthetic seed user (G18) and the password is the documented demo password.
 */
export interface DemoAccount {
  login: string; // part before @bhoomisetu.local
  dashboard: string;
  post: string;
  look: string;
}

export const DEMO_DOMAIN = 'bhoomisetu.local';

export const DEMO_ACCOUNTS: { group: string; accounts: DemoAccount[] }[] = [
  {
    group: 'Start here',
    accounts: [
      { login: 'oversight', dashboard: 'National dashboard', post: 'National oversight', look: 'KPIs, 3 breach alerts, payment gap, national map' },
      { login: 'collector.pune', dashboard: 'Collector dashboard', post: 'Collector, Pune', look: 'Deadline board, s.19 lapse in 34 days, interest liability' },
      { login: 'talathi.khedshivapur', dashboard: 'Field office + field app', post: 'Talathi, Khed Shivapur', look: 'Assigned parcels, walk the boundary, offline sync' },
    ],
  },
  {
    group: 'District officers',
    accounts: [
      { login: 'collector.satara', dashboard: 'Collector dashboard', post: 'Collector, Satara', look: 'Second district on the same corridor' },
      { login: 'lao.satara', dashboard: 'District desk', post: 'LAO, Satara', look: 'Open MH-PSX → Award: entry checks, payments, possession gate' },
      { login: 'treasury.satara', dashboard: 'GIS map → project money', post: 'Treasury Officer, Satara', look: 'Open MH-PSX → Families: disbursed vs acknowledged' },
      { login: 'tehsildar.haveli', dashboard: 'Field office', post: 'Tehsildar, Haveli', look: 'Verify surveyed parcels, request corrections' },
      { login: 'dilr.pune', dashboard: 'Field office', post: 'DILR, Pune', look: 'Parcel geometry, area-mismatch flags' },
      { login: 'rnr.satara', dashboard: 'GIS map → families', post: 'Administrator R&R, Satara', look: 'Affected families, R&R entitlements, passbooks' },
    ],
  },
  {
    group: 'State and other bodies',
    accounts: [
      { login: 'revenue.mh', dashboard: 'State view', post: 'Revenue Dept, Maharashtra', look: 'All Maharashtra projects, appraisal stage' },
      { login: 'rnr.commissioner.mh', dashboard: 'State view', post: 'Commissioner R&R, Maharashtra', look: 'R&R scheme approval (maker-checker)' },
      { login: 'pd.nhai', dashboard: 'Requiring body map', post: 'Project Director, NHAI', look: 'Sees only its own projects (database RLS)' },
      { login: 'sia.man', dashboard: 'SIA agency map', post: 'SIA agency', look: 'One project only: a post with an end date' },
      { login: 'dlsa.nagpur', dashboard: 'Consent observer map', post: 'DLSA observer, Nagpur', look: 'Scoped post: only the projects it observes' },
      { login: 'legal.mh', dashboard: 'Legal cell map', post: 'Legal Cell, Maharashtra', look: 'Scoped post: sees only what its jurisdiction allows' },
      { login: 'admin', dashboard: 'Everything', post: 'Super Admin', look: 'All screens, all data' },
      { login: 'demo', dashboard: 'Role switcher', post: 'Several posts', look: 'Choose a post after sign-in, switch any time' },
    ],
  },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        });
      }}
      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
      aria-label={`Copy ${label}`}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export function EvaluatorLogins({ password }: { password: string }) {
  return (
    <section
      id="evaluator-logins"
      aria-labelledby="evaluator-logins-title"
      className="scroll-mt-24 overflow-hidden rounded-xl border-2 border-[#ff9933] bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fff6ec] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a85406]">For SIH evaluators</p>
          <h2 id="evaluator-logins-title" className="text-2xl font-bold text-slate-950">
            Sign in to any dashboard with these accounts
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Every account is a synthetic demo user. Click <strong>Sign in</strong> to open the login form already filled in.
          </p>
        </div>
        <div className="rounded-lg border border-[#ffb866] bg-white px-4 py-3">
          <p className="text-xs text-slate-600">Password for every account</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="text-lg font-bold text-slate-950">{password}</code>
            <CopyButton text={password} label="password" />
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {DEMO_ACCOUNTS.map((g) => (
          <div key={g.group} className="px-5 py-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{g.group}</h3>
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {g.accounts.map((a) => {
                const email = `${a.login}@${DEMO_DOMAIN}`;
                return (
                  <li key={a.login} className="flex flex-col rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-950">{a.dashboard}</p>
                    <p className="text-xs text-slate-600">{a.post}</p>
                    <p className="mt-1 flex-1 text-sm text-slate-700">{a.look}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-900">{email}</code>
                      <CopyButton text={email} label={email} />
                      <Link
                        href={`/login?email=${encodeURIComponent(email)}`}
                        className="ml-auto rounded-md bg-[#1f3c8f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#182f72]"
                      >
                        Sign in →
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-700">
        <strong>Citizens</strong> need no account: open the{' '}
        <Link href="/portal" className="font-medium text-[#1f3c8f] underline">
          citizen portal
        </Link>{' '}
        and search village <em>Khed Shivapur</em>. Citizen sign-in uses a demo OTP shown on screen.
      </p>
    </section>
  );
}
