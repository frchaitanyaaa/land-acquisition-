import { describe, expect, it } from 'vitest';
import { formatCrore, formatINR, formatLakh, parsePaise, rupeesToPaise } from '../src/money';

describe('money (G9)', () => {
  it('parses rupees exactly', () => {
    expect(rupeesToPaise('4200000')).toBe(420000000n);
    expect(rupeesToPaise('0.1')).toBe(10n);
    expect(rupeesToPaise('₹ 1,50,000.05')).toBe(15000005n);
    expect(rupeesToPaise(12.34)).toBe(1234n);
    expect(() => rupeesToPaise('1.234')).toThrow();
    expect(() => rupeesToPaise('-5')).toThrow();
    expect(() => rupeesToPaise('abc')).toThrow();
  });
  it('parses paise strings', () => {
    expect(parsePaise('123')).toBe(123n);
    expect(() => parsePaise('1.5')).toThrow();
  });
  it('formats with Indian grouping', () => {
    expect(formatINR(420000000_00n)).toBe('₹42,00,00,000');
    expect(formatINR(15000005n)).toBe('₹1,50,000.05');
    expect(formatCrore(4_20_00_000_00n)).toBe('₹4.2 Cr');
    expect(formatLakh(42_00_000_00n)).toBe('₹42 L');
    expect(formatCrore(1_00_00_000_00n)).toBe('₹1 Cr');
  });
});
