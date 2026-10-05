'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoEmail, type DemoAccount } from '@/lib/demo-accounts';

/** One click: /login signs in by itself (demo mode, &go=1); the field app has its own sign-in at /field. */
const hrefFor = (a: DemoAccount) => (a.fieldApp ? '/field' : `/login?email=${encodeURIComponent(demoEmail(a))}&go=1`);

interface Card {
  key: string;
  icon: string;
  title: string;
  role: string;
  href: string;
  external: boolean;
}

const CARDS: Card[] = [
  ...DEMO_ACCOUNTS.filter((a) => a.primary).map((a) => ({
    key: a.login,
    icon: a.icon,
    title: a.screen,
    role: a.role,
    href: hrefFor(a),
    external: !!a.fieldApp,
  })),
  { key: 'portal', icon: 'groups', title: 'Citizen portal', role: 'Any citizen · no login', href: '/portal', external: false },
];
const MORE = DEMO_ACCOUNTS.filter((a) => !a.primary);

function Go({ href, external, className, children }: { href: string; external: boolean; className: string; children: React.ReactNode }) {
  // The field PWA is a separate app served at /field (not a Next route): a plain link.
  return external ? (
    <a href={href} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/**
 * Evaluator entry points (landing page, DEMO_MODE only — the page checks). Four one-click cards, the other roles
 * behind "More roles". Synthetic accounts only (G18; lib/demo-accounts.ts).
 */
export function EvaluatorLogins() {
  const [more, setMore] = useState(false);
  return (
    <section
      id="evaluator-logins"
      aria-labelledby="evaluator-logins-title"
      className="scroll-mt-24 rounded-xl border border-slate-200 border-t-4 border-t-[#ff9933] bg-white px-5 py-6 sm:px-8"
    >
      <div className="text-center">
        <h2 id="evaluator-logins-title" className="text-2xl font-bold text-slate-950">
          Try it — one click, no typing
        </h2>
        <p className="mt-1 text-sm text-slate-600">Each button opens the prototype as that person, with synthetic data.</p>
      </div>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CARDS.map((c) => (
          <li key={c.key}>
            <Go
              href={c.href}
              external={c.external}
              className="group flex h-full flex-col items-center rounded-lg border border-slate-200 p-3 text-center sm:p-5 transition hover:-translate-y-0.5 hover:border-[#1f3c8f] hover:shadow-md"
            >
              {/* Inline colour: globals.css pins .ux4g-icon-outlined's colour (UX4G 3.0.0 workaround). */}
              <span className="ux4g-icon-outlined text-4xl" style={{ color: '#1f3c8f' }} aria-hidden>
                {c.icon}
              </span>
              <span className="mt-2 text-sm font-semibold text-slate-950 sm:mt-3 sm:text-base">{c.title}</span>
              <span className="mb-3 text-xs text-slate-600 sm:text-sm">{c.role}</span>
              <span className="mt-auto rounded-md bg-[#1f3c8f] px-4 py-1.5 text-sm font-semibold text-white group-hover:bg-[#182f72]">
                Open →
              </span>
            </Go>
          </li>
        ))}
      </ul>

      <div className="mt-5 text-center">
        <button
          type="button"
          aria-expanded={more}
          aria-controls="more-roles"
          onClick={() => setMore((m) => !m)}
          className="text-sm font-medium text-[#1f3c8f] hover:underline"
        >
          More roles ({MORE.length}) {more ? '▴' : '▾'}
        </button>
        {more && (
          <ul id="more-roles" className="mx-auto mt-3 flex max-w-3xl flex-wrap justify-center gap-2">
            {MORE.map((a) => (
              <li key={a.login}>
                <Go
                  href={hrefFor(a)}
                  external={!!a.fieldApp}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:border-[#1f3c8f] hover:text-[#1f3c8f]"
                >
                  <span className="ux4g-icon-outlined text-base" aria-hidden>
                    {a.icon}
                  </span>
                  {a.screen} <span className="text-slate-500">· {a.role}</span>
                </Go>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-500">
        Prefer to type? Every account uses the password <code className="font-semibold text-slate-700">{DEMO_PASSWORD}</code>;
        the emails are listed on the sign-in page.
      </p>
    </section>
  );
}
