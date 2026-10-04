const STATE: Record<string, [string, string]> = {
  NOT_AWARDED: ['Not awarded', 'bg-slate-100 text-slate-600'],
  UNPAID: ['Unpaid', 'bg-slate-100 text-slate-700'],
  PART_PAID: ['Part paid', 'bg-sky-50 text-sky-800'],
  DISBURSED_NOT_ACKNOWLEDGED: ['Disbursed, not acknowledged', 'bg-amber-50 text-amber-900'],
  ACKNOWLEDGED: ['Acknowledged', 'bg-teal-50 text-teal-800'],
  // per-head entitlement statuses
  ASSESSED: ['Assessed', 'bg-slate-100 text-slate-700'],
  SANCTIONED: ['Sanctioned', 'bg-sky-50 text-sky-800'],
  DISBURSED: ['Disbursed', 'bg-amber-50 text-amber-900'],
  DEPOSITED_WITH_AUTHORITY: ['Deposited with Authority', 'bg-violet-50 text-violet-800'],
  UNDER_PROTEST: ['Under protest', 'bg-orange-50 text-orange-800'],
  // payment statuses
  INITIATED: ['Initiated', 'bg-slate-100 text-slate-700'],
  PENDING: ['Pending', 'bg-sky-50 text-sky-800'],
  SUCCESS: ['Paid', 'bg-emerald-50 text-emerald-800'],
  FAILED: ['Failed', 'bg-red-50 text-red-800'],
};

/** "Disbursed is what the office says. Acknowledged is what the family says." (§34 beat 6) */
export function MoneyState({ state }: { state: string }) {
  const [label, cls] = STATE[state] ?? [state.replace(/_/g, ' ').toLowerCase(), 'bg-slate-100 text-slate-700'];
  return <span className={`inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-black/5 ${cls}`}>{label}</span>;
}

/** G7 — every value from a mock adapter (payment, identity, SMS/OTP) carries this badge. */
export function MockBadge({ title = 'From a mock adapter — not a live system' }: { title?: string }) {
  return (
    <span title={title} className="inline-flex rounded bg-fuchsia-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fuchsia-800 ring-1 ring-inset ring-fuchsia-200">
      Mock
    </span>
  );
}

/** Adapter providers are named MOCK_* (or "mock") in dev and demo. */
export const isMockProvider = (provider: string | null | undefined) => !provider || /mock/i.test(provider);

/**
 * Navy hero banner for the money screens (A5). `ux4g-bg-primary-stronger` is navy once the theme
 * tokens in globals.css re-tint the UX4G primary scale (00-shared-context.md). Inverse text on navy
 * passes AA; never put white text on saffron.
 */
export function MoneyHero({ eyebrow, title, subtitle, actions }: { eyebrow?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="ux4g-bg-primary-stronger ux4g-text-neutral-inverse ux4g-p-l flex flex-wrap items-end justify-between gap-4 rounded-lg">
      <div className="min-w-0">
        {eyebrow && <p className="ux4g-body-s-default opacity-80">{eyebrow}</p>}
        <h1 className="ux4g-heading-l-strong">{title}</h1>
        {subtitle && <p className="ux4g-body-s-default mt-1 opacity-90">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

/** KPI card (A5): label, big value, optional coloured sub-metric. */
export function KpiCard({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'success' | 'warning' | 'error' | 'info' }) {
  const bar = { neutral: 'border-slate-300', success: 'border-emerald-600', warning: 'border-amber-500', error: 'border-red-600', info: 'border-sky-600' }[tone];
  return (
    <div className={`ux4g-card ux4g-card-outline ux4g-card-vertical border-l-4 ${bar}`}>
      <div className="ux4g-card-body">
        <p className="ux4g-label-s-default">{label}</p>
        <p className="ux4g-heading-s-strong tabular-nums">{value}</p>
        {sub && <p className="ux4g-body-xs-default text-slate-600">{sub}</p>}
      </div>
    </div>
  );
}
