import { describe, expect, it } from 'vitest';
import { canonicalJson } from '../src/canonical-json';

describe('canonicalJson (RFC 8785)', () => {
  it('sorts keys at every depth and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
      '{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}',
    );
  });

  it('is independent of insertion order', () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it('serialises numbers like ES2015 (the JCS rule)', () => {
    expect(canonicalJson([1.5, 1.0, 0.1, 1e21, -0])).toBe('[1.5,1,0.1,1e+21,0]');
  });

  it('sorts by UTF-16 code unit, not locale', () => {
    expect(canonicalJson({ é: 1, z: 2, Z: 3 })).toBe('{"Z":3,"z":2,"é":1}');
  });

  it('refuses bigint so paise are never silently coerced', () => {
    expect(() => canonicalJson({ amountPaise: 10n })).toThrow(/bigint/);
  });

  it('omits undefined object members and nulls undefined array slots', () => {
    expect(canonicalJson({ a: undefined, b: [undefined] })).toBe('{"b":[null]}');
  });
});
