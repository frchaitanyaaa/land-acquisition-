import type { Clock, Pack } from '../../schema/pack.schema';
import { computeDueAt, STATUTORY_TZ } from './time';

export type ConditionInputs = Record<string, boolean | undefined>;

export interface StartedClock {
  clockCode: string;
  section: string;
  duration: string;
  dueAt: Date;
  consequence: Clock['consequence'];
  consequenceText: string;
}

export function findClock(pack: Pack, clockCode: string): Clock {
  const clock = pack.clocks.find((c) => c.code === clockCode);
  if (!clock) throw new Error(`${pack.code}@${pack.version} has no clock ${clockCode}`);
  return clock;
}

/** Clocks the event starts, and clocks it satisfies. */
export const clocksStartedBy = (pack: Pack, event: string): Clock[] => pack.clocks.filter((c) => c.startsOn === event);
export const clocksSatisfiedBy = (pack: Pack, event: string): Clock[] => pack.clocks.filter((c) => c.endsOn === event);

export function clockDuration(clock: Clock, inputs: ConditionInputs = {}): string {
  if (clock.duration) return clock.duration;
  const hit = clock.durationWhen?.find((w) => inputs[w.if] === true);
  if (hit) return hit.duration;
  if (!clock.durationElse) throw new Error(`clock ${clock.code} has no duration`);
  return clock.durationElse;
}

/** Starts a clock. Returns null when the clock's `startsIf` input is not true. */
export function startClock(
  pack: Pack,
  clockCode: string,
  startedAt: Date,
  conditionInputs: ConditionInputs = {},
  tz: string = STATUTORY_TZ,
): StartedClock | null {
  const clock = findClock(pack, clockCode);
  if (clock.startsIf && conditionInputs[clock.startsIf] !== true) return null;
  const duration = clockDuration(clock, conditionInputs);
  return {
    clockCode: clock.code,
    section: clock.section,
    duration,
    dueAt: computeDueAt(startedAt, duration, tz),
    consequence: clock.consequence,
    consequenceText: clock.consequenceText,
  };
}
