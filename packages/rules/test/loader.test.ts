import { describe, expect, it } from 'vitest';
import { loadPacks, packChecksum, readPackFiles } from '../src/fs';
import { PackError, resolvePacks } from '../src/loader';

const files = readPackFiles();
const base = files.find((f) => (f as { code: string }).code === 'larr-2013-base') as Record<string, unknown>;

const child = (over: Record<string, unknown>) => ({
  code: 'test-child',
  version: '1.0.0',
  extends: { code: 'larr-2013-base', version: '1.0.0' },
  title: 'child',
  jurisdiction: { level: 'STATE', stateCode: '99' },
  ...over,
});

describe('resolvePacks', () => {
  it('resolves every committed pack', () => {
    const packs = loadPacks();
    expect([...packs.keys()].sort()).toEqual([
      'larr-2013-base@1.0.0',
      'larr-2013-maharashtra@1.0.0',
      'nh-act-1956@1.0.0',
    ]);
  });

  it('inherits everything the child does not set', () => {
    const mh = loadPacks().get('larr-2013-maharashtra@1.0.0');
    const b = loadPacks().get('larr-2013-base@1.0.0');
    expect(mh?.clocks).toEqual(b?.clocks);
    expect(mh?.stages).toEqual(b?.stages);
    expect(mh?.jurisdiction).toEqual({ level: 'STATE', stateCode: '27' });
  });

  it('appends new coded items and keeps the inherited ones', () => {
    const mh = loadPacks().get('larr-2013-maharashtra@1.0.0');
    const codes = mh?.checks.map((c) => c.code) ?? [];
    expect(codes).toContain('SOLATIUM_100');
    expect(codes.at(-1)).toBe('RURAL_FACTOR_BANDS');
  });

  it('accumulates verify notes from parent and child', () => {
    const mh = loadPacks().get('larr-2013-maharashtra@1.0.0');
    const b = loadPacks().get('larr-2013-base@1.0.0');
    expect(mh?.verify).toEqual(expect.arrayContaining([...(b?.verify ?? [])]));
    expect(mh?.verify?.some((v) => v.includes('multiplication factor'))).toBe(true);
  });

  it('merges a coded item field by field', () => {
    const packs = resolvePacks([
      base,
      child({ clocks: [{ code: 'DECLARATION', consequenceText: 'overridden text' }] }),
    ]);
    const decl = packs.get('test-child@1.0.0')?.clocks.find((c) => c.code === 'DECLARATION');
    expect(decl?.consequenceText).toBe('overridden text');
    expect(decl?.duration).toBe('P12M'); // untouched field survives
  });

  it('rejects a child that breaks the schema after merging', () => {
    expect(() => resolvePacks([base, child({ consent: { PPP: 1.7 } })])).toThrow(PackError);
  });

  it('rejects a missing parent', () => {
    expect(() => resolvePacks([child({})])).toThrow(/larr-2013-base@1.0.0: not found/);
  });

  it('rejects an extends cycle', () => {
    const a = { ...child({}), code: 'a', extends: { code: 'b', version: '1.0.0' } };
    const b = { ...child({}), code: 'b', extends: { code: 'a', version: '1.0.0' } };
    expect(() => resolvePacks([a, b])).toThrow(/cycle/);
  });

  it('rejects an action whose reason code is not in the catalog', () => {
    const bad = structuredClone(base) as { stages: Array<{ actions: Record<string, { reasonCodes?: string[] }> }> };
    bad.stages[0]!.actions.RETURN!.reasonCodes = ['NOT_A_REAL_CODE'];
    expect(() => resolvePacks([bad])).toThrow(/NOT_A_REAL_CODE is not in the reasonCodes catalog/);
  });
});

describe('packChecksum', () => {
  it('is stable across key order', () => {
    const p = loadPacks().get('larr-2013-base@1.0.0')!;
    const reverseKeys = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reverseKeys)
        : v && typeof v === 'object'
          ? Object.fromEntries(
              Object.entries(v)
                .reverse()
                .map(([k, x]) => [k, reverseKeys(x)]),
            )
          : v;
    const reordered = reverseKeys(p) as typeof p;
    expect(Object.keys(reordered)[0]).not.toBe(Object.keys(p)[0]);
    expect(packChecksum(reordered)).toBe(packChecksum(p));
  });

  it('changes when any statutory value changes', () => {
    const p = loadPacks().get('larr-2013-base@1.0.0')!;
    const changed = { ...p, consent: { ...p.consent, PPP: 0.75 } };
    expect(packChecksum(changed)).not.toBe(packChecksum(p));
  });
});
