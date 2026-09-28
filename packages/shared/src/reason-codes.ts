import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Reason-code display labels (§12.7). The codes themselves live in the rule packs
// (packages/rules/packs/*.json, the `reasonCodes` map) — this only supplies a human label per
// locale so the codes never need retyping here. hi/mr entries are machine-drafted and carry
// needsNativeReview: true (§9) until a native speaker checks them; never present them as settled.
//
// Node-only (reads packages/shared/i18n/*.json off disk) — import from '@bhoomisetu/shared/reason-codes',
// never from the main '@bhoomisetu/shared' barrel, so portal/field's browser bundles never pull in node:fs.

export interface ReasonCodeLabel {
  label: string;
  needsNativeReview: boolean;
}
export type ReasonCodeLocale = 'en' | 'hi' | 'mr';
export const REASON_CODE_LOCALES: readonly ReasonCodeLocale[] = ['en', 'hi', 'mr'];

/** Walks up from this file to find the repo root (pnpm-workspace.yaml), without depending on @bhoomisetu/db. */
function repoRootFrom(start: string): string {
  let dir = start;
  while (!existsSync(join(dir, 'pnpm-workspace.yaml'))) {
    const up = dirname(dir);
    if (up === dir) throw new Error('could not find the repo root (pnpm-workspace.yaml)');
    dir = up;
  }
  return dir;
}

const cache = new Map<ReasonCodeLocale, Record<string, ReasonCodeLabel>>();

export function loadReasonCodeLabels(locale: ReasonCodeLocale): Record<string, ReasonCodeLabel> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const path = join(repoRootFrom(__dirname), 'packages', 'shared', 'i18n', `reason-codes.${locale}.json`);
  const data = JSON.parse(readFileSync(path, 'utf8')) as Record<string, ReasonCodeLabel>;
  cache.set(locale, data);
  return data;
}

/** Falls back to the raw code (never throws) when a code has no label yet in that locale. */
export function getReasonCodeLabel(code: string, locale: ReasonCodeLocale = 'en'): ReasonCodeLabel {
  const labels = loadReasonCodeLabels(locale);
  return labels[code] ?? { label: code, needsNativeReview: locale !== 'en' };
}
