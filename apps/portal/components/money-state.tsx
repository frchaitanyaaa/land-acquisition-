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
