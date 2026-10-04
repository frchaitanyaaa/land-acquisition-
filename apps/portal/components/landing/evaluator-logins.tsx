'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoEmail } from '@/lib/demo-accounts';

const SIGN_IN = 'ml-auto rounded-md bg-[#1f3c8f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#182f72]';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        // Clipboard can be denied (insecure origin, browser policy): the text stays visible to copy by hand.
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => {});
      }}
      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
      aria-label={`Copy ${label}`}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  );
}

/**
 * Evaluator sign-in sheet (landing page, DEMO_MODE only — the page checks). One synthetic account per distinct
 * screen (lib/demo-accounts.ts); "Sign in" opens /login already filled in.
 */
export function EvaluatorLogins() {
  return (
    <section
      id="evaluator-logins"
      aria-labelledby="evaluator-logins-title"
      className="scroll-mt-24 overflow-hidden rounded-xl border-2 border-[#ff9933] bg-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#fff6ec] px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#a85406]">For evaluators</p>
          <h2 id="evaluator-logins-title" className="text-xl font-bold text-slate-950">
            One account per screen
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#ffb866] bg-white px-3 py-2">
          <span className="text-xs text-slate-600">Password for all</span>
          <code className="font-bold text-slate-950">{DEMO_PASSWORD}</code>
          <CopyButton text={DEMO_PASSWORD} label="password" />
        </div>
      </div>

      <ul className="grid gap-px bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_ACCOUNTS.map((a) => {
          const email = demoEmail(a);
          return (
            <li key={a.login} className="flex flex-col bg-white p-4">
              <p className="font-semibold text-slate-950">{a.screen}</p>
              <p className="text-xs text-slate-600">{a.post}</p>
              <p className="mt-1 flex-1 text-sm text-slate-700">{a.look}</p>
              <code className="mt-2 break-all text-xs text-slate-800">{email}</code>
              <div className="mt-2 flex items-center gap-2">
                <CopyButton text={email} label={email} />
                {a.fieldApp ? (
                  // The field PWA is a separate app served at /field (not a Next route): a plain link.
                  <a href="/field" className={SIGN_IN}>
                    Open field app →
                  </a>
                ) : (
                  <Link href={`/login?email=${encodeURIComponent(email)}`} className={SIGN_IN}>
                    Sign in →
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
