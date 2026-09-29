import { formatCrore, formatINR, formatLakh } from '@bhoomisetu/shared';

/** The API returns bigint columns (paise) as JSON strings — never parse them as `number`. */
export function paise(v: string | number | bigint | null | undefined): bigint {
  if (v === null || v === undefined) return 0n;
  return typeof v === 'bigint' ? v : BigInt(v);
}

/** Picks crore or lakh, whichever reads more naturally for the amount (§9 money conventions). */
export function formatMoney(v: string | number | bigint | null | undefined): string {
  const p = paise(v);
  const abs = p < 0n ? -p : p;
  if (abs >= 1_00_00_000n * 100n) return formatCrore(p);
  if (abs >= 1_00_000n * 100n) return formatLakh(p);
  return formatINR(p);
}

export function formatNum(v: string | number | null | undefined, digits = 0): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: digits });
}

export function formatPct(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) return '—';
  return `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
}

const SQM_PER_HECTARE = 10_000;

/** Area is stored in m² (G10); dashboards show hectares. */
export function formatHectares(sqm: string | number | null | undefined): string {
  if (sqm === null || sqm === undefined) return '—';
  const n = typeof sqm === 'number' ? sqm : Number(sqm);
  if (Number.isNaN(n)) return '—';
  return `${(n / SQM_PER_HECTARE).toLocaleString('en-IN', { maximumFractionDigits: 1 })} ha`;
}
