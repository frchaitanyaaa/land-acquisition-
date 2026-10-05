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
  // Nothing disbursed yet: an empty bar, not a full "unconfirmed" one.
  const unconfPct = paid > 0n ? Math.max(0, 100 - ackPct) : 0;

  return (
    <div className="col-span-full flex flex-wrap items-center gap-6 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <Donut ackPct={ackPct} unconfPct={unconfPct} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">Disbursed vs. acknowledged</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-900">{formatMoney(paid)}</span>
          <span className="text-sm text-slate-500">{paid > 0n ? 'disbursed' : 'disbursed — no payments yet'}</span>
        </div>
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-sm bg-slate-100">
          <div className="h-full bg-teal-700" style={{ width: `${ackPct}%` }} />
          {paid > 0n && <div className="h-full w-0.5 bg-white" />}
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
    </div>
  );
}

/** Acknowledged (teal) and unconfirmed (amber) as a ring; an empty grey ring when nothing is disbursed. */
function Donut({ ackPct, unconfPct }: { ackPct: number; unconfPct: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const ack = (ackPct / 100) * c;
  const unconf = (unconfPct / 100) * c;
  return (
    <svg viewBox="0 0 88 88" className="h-24 w-24 shrink-0" role="img" aria-label={`${ackPct}% acknowledged`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <g transform="rotate(-90 44 44)">
        {ack > 0 && (
          <circle cx="44" cy="44" r={r} fill="none" stroke="#0f766e" strokeWidth="10" strokeDasharray={`${ack} ${c}`} />
        )}
        {unconf > 0 && (
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="10"
            strokeDasharray={`${unconf} ${c}`}
            strokeDashoffset={-ack}
          />
        )}
      </g>
      <text x="44" y="44" textAnchor="middle" className="fill-slate-900 text-[15px] font-semibold">
        {unconfPct + ackPct > 0 ? `${Math.round(ackPct)}%` : '—'}
      </text>
      <text x="44" y="57" textAnchor="middle" className="fill-slate-500 text-[7px]">
        acknowledged
      </text>
    </svg>
  );
}
