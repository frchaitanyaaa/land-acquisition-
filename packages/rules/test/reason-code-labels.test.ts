import { getReasonCodeLabel, REASON_CODE_LOCALES } from '@bhoomisetu/shared/reason-codes';
import { describe, expect, it } from 'vitest';
import { loadPacks } from '../src/fs';

// §12.7 / §5: every reasonCode a pack can actually return to a client must have a label in every
// locale (packages/shared/i18n/reason-codes.*.json), or the portal's action panel (§13) would show
// a raw enum value to an officer. Reads the codes from the packs themselves so this can never drift.

describe('reason code i18n completeness', () => {
  const packs = [...loadPacks().values()];
  const allCodes = new Set<string>();
  for (const pack of packs) for (const codes of Object.values(pack.reasonCodes)) for (const c of codes) allCodes.add(c);

  it('found at least one reason code to check (packs are not empty)', () => {
    expect(allCodes.size).toBeGreaterThan(0);
  });

  for (const locale of REASON_CODE_LOCALES) {
    it(`every reason code across every pack has a ${locale} label`, () => {
      const missing = [...allCodes].filter((code) => getReasonCodeLabel(code, locale).label === code);
      expect(missing, `missing ${locale} labels: ${missing.join(', ')}`).toEqual([]);
    });
  }
});
