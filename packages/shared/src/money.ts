import type { Paise } from './index';

// Money is integer paise (G9). Officer input is rupees with up to 2 decimals, parsed exactly.

const RUPEES = /^(\d{1,15})(?:\.(\d{1,2}))?$/;

/** "4200000.5" → 420000050n. Commas and a leading ₹ are accepted. Throws on anything else. */
export function rupeesToPaise(input: string | number): Paise {
  const s = String(input).trim().replace(/^₹\s*/, '').replace(/,/g, '');
  const m = RUPEES.exec(s);
  if (!m) throw new Error(`not a rupee amount with up to 2 decimals: "${String(input)}"`);
  const [, whole, frac = ''] = m;
  return BigInt(whole!) * 100n + BigInt(frac.padEnd(2, '0'));
}

/** Parses a paise value that travelled as a JSON string. */
export function parsePaise(v: string | number | bigint): Paise {
  if (typeof v === 'bigint') return v;
  const s = String(v);
  if (!/^-?\d+$/.test(s)) throw new Error(`not integer paise: "${s}"`);
  return BigInt(s);
}

const groupIN = (n: bigint) => new Intl.NumberFormat('en-IN').format(n);

/** 420000000n → "₹42,00,000" (drops ".00"; keeps paise when present). */
export function formatINR(paise: Paise): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const rupees = abs / 100n;
  const p = abs % 100n;
  return `${neg ? '-' : ''}₹${groupIN(rupees)}${p ? `.${p.toString().padStart(2, '0')}` : ''}`;
}

function scaled(paise: Paise, unitPaise: bigint, suffix: string): string {
  // one decimal, half-up, integer arithmetic
  const tenths = (paise * 10n * 2n + unitPaise) / (unitPaise * 2n);
  const whole = tenths / 10n;
  const d = tenths % 10n;
  return `₹${groupIN(whole)}${d ? `.${d}` : ''} ${suffix}`;
}

/** ₹1 Cr = 1,00,00,000 rupees. 420000000_00n → "₹4.2 Cr". */
export const formatCrore = (paise: Paise) => scaled(paise, 1_00_00_000n * 100n, 'Cr');
/** ₹1 L = 1,00,000 rupees. */
export const formatLakh = (paise: Paise) => scaled(paise, 1_00_000n * 100n, 'L');
