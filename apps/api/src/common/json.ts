/** JSON cannot carry bigint; paise travel as decimal strings. */
export const bigintToString = (v: unknown): unknown => (typeof v === 'bigint' ? v.toString() : v);

/** A deep copy that JSON (and jsonb columns) can hold: bigint → string, Date → ISO string. */
export function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  return JSON.parse(JSON.stringify(value, (_k, v: unknown) => bigintToString(v))) as unknown;
}
