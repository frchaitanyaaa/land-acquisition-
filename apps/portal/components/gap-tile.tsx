import { formatMoney, paise } from '@/lib/format';

/**
 * "Disbursed is what the office says. Acknowledged is what the family says." (§34 beat 6) — the
 * single most important money figure on the national dashboard: paid vs acknowledged vs the gap
 * between them. A stacked bar shows the proportion; the three numbers give the exact figures.
 */
export function GapTile({
  paidPaise,
  acknowledgedPaise,
  unconfirmedPaise,
}: {
  paidPaise: string;
  acknowledgedPaise: string;
  unconfirmedPaise: string;
}) {
  const paid = paise(paidPaise);
  const acknowledged = paise(acknowledgedPaise);
  const unconfirmed = paise(unconfirmedPaise);
  const total = paid > 0n ? paid : 1n;
  const ackPct = Number((acknowledged * 1000n) / total) / 10;
  const unconfPct = Math.max(0, 100 - ackPct);

  return (
    <div className="col-span-full border border-slate-200 bg-white px-5 py-4 sm:col-span-2">
      <p className="text-xs font-medium text-slate-500">Disbursed vs. acknowledged</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(paid)}</span>
        <span className="text-sm text-slate-500">disbursed</span>
      </div>
      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-sm bg-slate-100">
        <div className="h-full bg-teal-700" style={{ width: `${ackPct}%` }} />
        <div className="h-full w-0.5 bg-white" />
        <div className="h-full bg-amber-500" style={{ width: `${unconfPct}%` }} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-slate-500">
            <span aria-hidden className="h-2 w-2 rounded-full bg-teal-700" />
            Acknowledged
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">{formatMoney(acknowledged)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-slate-500">
            <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" />
            Unconfirmed
          </dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-amber-700">{formatMoney(unconfirmed)}</dd>
        </div>
      </dl>
    </div>
  );
}
