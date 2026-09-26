import { describe, expect, it } from 'vitest';
import { ClockService } from '../src/common/clock/clock.service';

describe('ClockService (G16)', () => {
  it('is frozen at DEMO_NOW and never drifts', async () => {
    const clock = new ClockService('2026-12-10T10:00:00+05:30');
    const first = clock.now();
    await new Promise((r) => setTimeout(r, 5));
    expect(clock.now().toISOString()).toBe('2026-12-10T04:30:00.000Z');
    expect(clock.now()).toEqual(first);
    expect(clock.frozen).toBe(true);
  });

  it('hands out copies, so callers cannot move the frozen clock', () => {
    const clock = new ClockService('2026-12-10T10:00:00+05:30');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('follows the real clock when DEMO_NOW is unset', () => {
    const clock = new ClockService(undefined);
    expect(clock.frozen).toBe(false);
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('rejects a malformed DEMO_NOW at boot', () => {
    expect(() => new ClockService('10 December')).toThrow(/DEMO_NOW/);
  });
});
