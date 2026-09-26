import { describe, expect, it } from 'vitest';
import { loadPacks } from '../src/fs';
import type { Pack } from '../src/index';
import { ACT, rupeesToPaise } from './act-reference';

// Golden statutory test (CLAUDE.md §32.3). Runs against every pack that extends the base, so a
// state pack cannot silently override a statutory number either.

const packs = loadPacks();
const statutoryPacks = [...packs.values()].filter(
  (p) => p.code === 'larr-2013-base' || p.extends?.code === 'larr-2013-base',
);

const clock = (pack: Pack, code: string) => {
  const c = pack.clocks.find((x) => x.code === code);
  if (!c) throw new Error(`${pack.code}@${pack.version} has no clock ${code}`);
  return c;
};
const check = (pack: Pack, code: string) => {
  const c = pack.checks.find((x) => x.code === code);
  if (!c) throw new Error(`${pack.code}@${pack.version} has no check ${code}`);
  return c;
};
const head = (pack: Pack, code: string) => {
  const h = pack.entitlementHeads.find((x) => x.code === code);
  if (!h) throw new Error(`${pack.code}@${pack.version} has no entitlement head ${code}`);
  return h;
};

it('found the base pack', () => {
  expect(packs.has('larr-2013-base@1.0.0')).toBe(true);
});

describe.each(statutoryPacks.map((p) => [`${p.code}@${p.version}`, p] as const))('%s', (_key, pack) => {
  it('consent thresholds (s.2)', () => {
    expect(pack.consent.PRIVATE).toBe(ACT.consent.PRIVATE);
    expect(pack.consent.PPP).toBe(ACT.consent.PPP);
    expect(pack.consent.GOVERNMENT ?? null).toBe(ACT.consent.GOVERNMENT);
    expect(pack.consent.scheduledAreaGramSabha).toBe(true);
  });

  for (const [code, expected] of Object.entries(ACT.clocks)) {
    it(`clock ${code} (s.${expected.section})`, () => {
      const c = clock(pack, code);
      expect(c.section).toBe(expected.section);
      expect(c.duration).toBe(expected.duration);
      if ('consequence' in expected) expect(c.consequence).toBe(expected.consequence);
    });
  }

  it('reference window: 6 weeks if present at award, 6 months otherwise (s.64)', () => {
    const c = clock(pack, 'REFERENCE_WINDOW');
    expect(c.section).toBe(ACT.referenceWindow.section);
    expect(c.durationWhen).toEqual([{ if: 'presentAtAward', duration: ACT.referenceWindow.ifPresent }]);
    expect(c.durationElse).toBe(ACT.referenceWindow.otherwise);
  });

  it('interest 9% then 15% after one year (s.80)', () => {
    expect(pack.interest).toMatchObject({
      section: ACT.interest.section,
      rateYear1Pct: ACT.interest.year1Pct,
      rateAfterPct: ACT.interest.afterPct,
      stepAfter: ACT.interest.stepAfter,
    });
    expect(clock(pack, 'INTEREST_STEP').duration).toBe(ACT.interest.stepAfter);
  });

  it('solatium 100% and 12% additional amount (s.30)', () => {
    expect(check(pack, 'SOLATIUM_100').params.pct).toBe(ACT.solatiumPct);
    expect(check(pack, 'ADDITIONAL_12PA_PRESENT').params.ratePctPerAnnum).toBe(ACT.additionalAmountPctPerAnnum);
  });

  it('multiplication factor: rural 1.00–2.00, urban 1.00 (First Schedule)', () => {
    expect(check(pack, 'RURAL_FACTOR_RANGE').params).toEqual(ACT.multiplicationFactor);
  });

  it('urgency: 80% tendered, 75% additional (s.40)', () => {
    expect(check(pack, 'URGENCY_80_TENDERED').params.pct).toBe(ACT.urgency.tenderedPct);
    expect(check(pack, 'URGENCY_ADDITIONAL_75').params.pct).toBe(ACT.urgency.additionalPct);
  });

  it('SC/ST first instalment at least one-third (s.41)', () => {
    const p = check(pack, 'SC_ST_FIRST_INSTALMENT').params;
    expect([p.numerator, p.denominator]).toEqual([
      ACT.scStFirstInstalment.numerator,
      ACT.scStFirstInstalment.denominator,
    ]);
    expect(pack.thresholds.scStFirstInstalmentMinFraction).toBeCloseTo(1 / 3, 3);
  });

  it('R&R Committee at 100 acres (s.45)', () => {
    expect(pack.thresholds.rnrCommitteeAcres).toBe(ACT.rnrCommitteeAcres);
  });

  it('Second Schedule minimums', () => {
    const s = ACT.secondSchedule;
    expect(head(pack, 'HOUSING_URBAN').min).toEqual({ value: s.urbanHousePlinthSqm, unit: 'sqm_plinth' });
    expect(head(pack, 'HOUSING_URBAN_OPTOUT').minPaise).toBe(rupeesToPaise(s.urbanHouseOptOutRupees));
    expect(head(pack, 'ONE_TIME_5L').minPaise).toBe(rupeesToPaise(s.oneTimeInLieuOfEmploymentRupees));
    expect(head(pack, 'ANNUITY')).toMatchObject({
      minPaise: rupeesToPaise(s.annuityRupeesPerMonth),
      per: 'MONTH',
      periods: s.annuityMonths,
    });
    expect(head(pack, 'SUBSISTENCE')).toMatchObject({
      minPaise: rupeesToPaise(s.subsistenceRupeesPerMonth),
      per: 'MONTH',
      periods: s.subsistenceMonths,
    });
    expect(head(pack, 'SUBSISTENCE_SCST_EXTRA').minPaise).toBe(rupeesToPaise(s.scStScheduledAreaExtraRupees));
    expect(head(pack, 'TRANSPORT').minPaise).toBe(rupeesToPaise(s.transportRupees));
    expect(head(pack, 'CATTLE_SHED').minPaise).toBe(rupeesToPaise(s.cattleShedMinRupees));
    expect(head(pack, 'ARTISAN_GRANT').minPaise).toBe(rupeesToPaise(s.artisanMinRupees));
    expect(head(pack, 'RESETTLEMENT_ALLOWANCE').minPaise).toBe(rupeesToPaise(s.resettlementAllowanceRupees));
    expect(head(pack, 'SCST_OUTSIDE_DISTRICT').minPaise).toBe(rupeesToPaise(s.scStOutsideDistrictRupees));
    expect(head(pack, 'LAND_FOR_LAND').min).toEqual({ value: s.landForLandMinAcres, unit: 'acre' });
    expect(head(pack, 'DEVELOPED_LAND').min).toEqual({ value: s.developedLandPct, unit: 'pct_of_acquired_land' });
  });

  it('Second Schedule heads are entitlements, never Third Schedule amenities', () => {
    for (const h of pack.entitlementHeads) expect(['FIRST', 'SECOND', 'SC_ST_ADDITIONAL']).toContain(h.schedule);
  });

  it('consent stage applies to PPP / PRIVATE / Scheduled Area, and government projects are exempt', () => {
    const s04 = pack.stages.find((s) => s.code === 'S04_CONSENT');
    expect(s04?.appliesWhen).toEqual({
      any: [{ acquisitionTypeIn: ['PPP', 'PRIVATE'] }, { inScheduledArea: true }],
    });
  });
});
