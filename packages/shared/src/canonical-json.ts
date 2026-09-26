// RFC 8785 (JCS) canonical JSON. Used wherever bytes are hashed — rule-pack checksums now,
// anchor payloads later (CLAUDE.md §27.2).
//
// JCS orders object keys by UTF-16 code unit, which is exactly Array.prototype.sort's default,
// and serialises numbers the way JSON.stringify does. So this is the whole algorithm.
// bigint is rejected on purpose: JSON has no bigint, and silently turning paise into a lossy
// number would change a hash. Convert paise to a string before hashing.

export function canonicalJson(value: unknown): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: non-finite number ${value}`);
      return JSON.stringify(value);
    case 'bigint':
      throw new TypeError('canonicalJson: bigint is not JSON; convert paise to a string first');
    case 'undefined':
    case 'function':
    case 'symbol':
      throw new TypeError(`canonicalJson: ${typeof value} is not JSON`);
  }

  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}
