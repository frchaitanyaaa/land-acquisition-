'use client';

import type { Pack } from '@bhoomisetu/rules';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useRulePack } from '@/lib/project-api';

interface PackSummary {
  code: string;
  version: string;
  title: string;
  governingAct: string;
  jurisdiction: { level: string; stateCode?: string };
  extends: { code: string; version: string } | null;
  effectiveFrom: string;
  checksum: string;
  stages: number;
  clocks: number;
  verify: string[];
}

const DEFAULT_LEFT = 'larr-2013-maharashtra@1.0.0';
const DEFAULT_RIGHT = 'nh-act-1956@1.0.0';

const split = (key: string) => {
  const i = key.lastIndexOf('@');
  return { code: key.slice(0, i), version: key.slice(i + 1) };
};

type Clock = Pack['clocks'][number];
const duration = (c: Clock) =>
  c.duration ?? [...(c.durationWhen ?? []).map((w) => `${w.duration} if ${w.if}`), `else ${c.durationElse}`].join('; ');

/**
 * Rule pack viewer (§12, demo beat 8): the same engine running two different statutes. Every
 * pack's verify[] is shown first and in full (§12.4) — "so nobody presents placeholder values as
 * law" — including the notes a pack inherits through `extends`.
 */
export default function RulePacksPage() {
  const list = useQuery({ queryKey: ['rule-packs'], queryFn: () => api<PackSummary[]>('/rules/packs') });
  const [left, setLeft] = useState(DEFAULT_LEFT);
  const [right, setRight] = useState<string | null>(DEFAULT_RIGHT);

  if (list.error) return <p className="text-red-700">Could not load rule packs.</p>;
  if (list.isLoading || !list.data) return <p className="text-slate-500">Loading…</p>;
  const keys = list.data.map((p) => `${p.code}@${p.version}`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Rule packs</h1>
        <p className="text-sm text-slate-600">
          One workflow engine; the statute is configuration. Change the pack, not the code.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 text-sm">
        <PackSelect label="Pack" value={left} keys={keys} onChange={setLeft} />
        {right !== null ? (
          <>
            <PackSelect label="Compare with" value={right} keys={keys} onChange={setRight} />
            <button onClick={() => setRight(null)} className="text-xs text-slate-500 hover:underline">
              Show one pack
            </button>
          </>
        ) : (
          <button
            onClick={() => setRight(keys.find((k) => k !== left) ?? left)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Compare with another pack
          </button>
        )}
      </div>

      <div className={`grid gap-4 ${right !== null ? 'lg:grid-cols-2' : ''}`}>
        <PackColumn packKey={left} other={right} summaries={list.data} />
        {right !== null && <PackColumn packKey={right} other={left} summaries={list.data} />}
      </div>
    </div>
  );
}

function PackSelect({
  label,
  value,
  keys,
  onChange,
}: {
  label: string;
  value: string;
  keys: string[];
  onChange: (k: string) => void;
}) {
  return (
    <label>
      <span className="block text-xs text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
      >
        {keys.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  );
}

function PackColumn({
  packKey,
  other,
  summaries,
}: {
  packKey: string;
  other: string | null;
  summaries: PackSummary[];
}) {
  const { code, version } = split(packKey);
  const pack = useRulePack(code, version);
  const o = other ? split(other) : null;
  const otherPack = useRulePack(o?.code, o?.version);
  const summary = summaries.find((s) => s.code === code && s.version === version);
  const parent = summary?.extends
    ? summaries.find((s) => s.code === summary.extends!.code && s.version === summary.extends!.version)
    : undefined;

  if (pack.error) return <p className="text-red-700">Could not load {packKey}.</p>;
  if (pack.isLoading || !pack.data) return <p className="text-slate-500">Loading {packKey}…</p>;
  const p = pack.data;
  const otherStages = new Set(otherPack.data?.stages.map((s) => s.code) ?? []);
  const otherClocks = new Set(otherPack.data?.clocks.map((c) => c.code) ?? []);
  const inherited = (parent?.verify ?? []).filter((v) => !(p.verify ?? []).includes(v));

  return (
    <div className="space-y-4">
      <VerifyBanner
        own={p.verify ?? []}
        inherited={inherited}
        parentKey={parent ? `${parent.code}@${parent.version}` : null}
      />

      <section className="border border-slate-200 bg-white px-4 py-3">
        <p className="text-base font-semibold">{p.title}</p>
        <p className="font-mono text-xs text-slate-500">
          {p.code}@{p.version}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">Governing act</dt>
          <dd>{p.governingAct}</dd>
          <dt className="text-slate-500">Jurisdiction</dt>
          <dd>
            {p.jurisdiction.level}
            {p.jurisdiction.stateCode ? ` · state ${p.jurisdiction.stateCode}` : ''}
          </dd>
          <dt className="text-slate-500">Extends</dt>
          <dd>{p.extends ? `${p.extends.code}@${p.extends.version}` : '—'}</dd>
          <dt className="text-slate-500">In force from</dt>
          <dd>{p.effectiveFrom}</dd>
          <dt className="text-slate-500">Applies to</dt>
          <dd>{p.appliesTo.acquisitionTypes.join(', ')}</dd>
          {summary && (
            <>
              <dt className="text-slate-500">Checksum</dt>
              <dd className="truncate font-mono text-xs" title={summary.checksum}>
                {summary.checksum.slice(0, 16)}…
              </dd>
            </>
          )}
        </dl>
      </section>

      <Block title={`Stages (${p.stages.length})`} hint={other ? 'Highlighted: not in the compared pack' : undefined}>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100">
            {[...p.stages]
              .sort((a, b) => a.order - b.order)
              .map((s) => (
                <tr key={s.code} className={other && !otherStages.has(s.code) ? 'bg-sky-50/60' : ''}>
                  <td className="w-8 px-3 py-1.5 text-slate-400">{s.order}</td>
                  <td className="px-2 py-1.5">
                    <span className="font-mono text-xs">{s.code}</span>
                    <span className="block text-slate-700">{s.name}</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-slate-500">{s.sections.join(', ')}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-500">{s.ownerRole}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </Block>

      <Block title={`Clocks (${p.clocks.length})`} hint={other ? 'Highlighted: not in the compared pack' : undefined}>
        {p.clocks.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">No clocks.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {p.clocks.map((c) => (
              <li key={c.code} className={`px-3 py-2 ${other && !otherClocks.has(c.code) ? 'bg-sky-50/60' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    <span className="font-mono text-xs">{c.code}</span>{' '}
                    <span className="text-slate-700">{c.label}</span>
                  </span>
                  <span className="text-xs text-slate-500">{c.section}</span>
                </div>
                <p className="text-xs text-slate-600">
                  <span className="font-mono">{duration(c)}</span> from {c.startsOn}
                  {c.endsOn ? ` until ${c.endsOn}` : ''} → <span className="font-medium">{c.consequence}</span>:{' '}
                  {c.consequenceText}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title="Consent thresholds">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-sm">
          <dt className="text-slate-500">Private</dt>
          <dd>{p.consent.PRIVATE != null ? `${Math.round(p.consent.PRIVATE * 100)}%` : '—'}</dd>
          <dt className="text-slate-500">PPP</dt>
          <dd>{p.consent.PPP != null ? `${Math.round(p.consent.PPP * 100)}%` : '—'}</dd>
          <dt className="text-slate-500">Government</dt>
          <dd>not required</dd>
          <dt className="text-slate-500">Scheduled Area Gram Sabha</dt>
          <dd>{p.consent.scheduledAreaGramSabha ? 'required' : 'not required'}</dd>
        </dl>
      </Block>

      <Block title={`Award checks (${p.checks.length})`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {p.checks.map((c) => (
            <li key={c.code} className="px-3 py-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-xs">{c.code}</span>
                <span className="text-xs text-slate-500">
                  {c.section} · {c.kind}
                </span>
              </div>
              <p className="text-slate-700">{c.message}</p>
              {Object.values(c.params).some((v) => /placeholder/i.test(String(v))) && (
                <p className="mt-1 text-xs font-semibold text-amber-800">
                  ⚠ Parameters are placeholders — see the verify notes above.
                </p>
              )}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Interest (s.80) and entitlement heads">
        <p className="px-3 pt-2 text-sm text-slate-700">
          {p.interest.section}: {p.interest.rateYear1Pct}% for the first year, {p.interest.rateAfterPct}% after (
          {p.interest.dayCount}) — shown in the portal only as an estimated liability.
        </p>
        <ul className="grid grid-cols-1 gap-x-4 px-3 py-2 text-xs text-slate-600 sm:grid-cols-2">
          {p.entitlementHeads.map((h) => (
            <li key={h.code}>
              <span className="font-mono">{h.code}</span> · {h.kind}
              {h.minPaise ? ` · min ${formatMoney(h.minPaise)}${h.per ? `/${h.per.toLowerCase()}` : ''}` : ''}
            </li>
          ))}
        </ul>
      </Block>
    </div>
  );
}

/** §12.4: the pack's verify[] notes, rendered first and in full (headline wording removed 5 Oct 2026 at the team's request). */
function VerifyBanner({ own, inherited, parentKey }: { own: string[]; inherited: string[]; parentKey: string | null }) {
  if (!own.length && !inherited.length) return null;
  return (
    <section className="border-2 border-amber-400 bg-amber-50 px-4 py-3 text-amber-950">
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {own.map((v, i) => (
          <li key={i}>{v}</li>
        ))}
      </ul>
      {inherited.length > 0 && (
        <>
          <p className="mt-2 text-xs font-semibold">Inherited from {parentKey}:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {inherited.map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border border-slate-200 bg-white">
      <div className="flex items-baseline justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
