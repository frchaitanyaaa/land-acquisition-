import { z } from 'zod';
import { PackSchema, RawPackSchema, type Pack, type RawPack } from '../schema/pack.schema';

// Resolves `extends` chains (CLAUDE.md §12.1). Pure: takes parsed JSON, returns validated packs.
//
// Merge rules, child over parent:
//   - objects merge key by key, recursively
//   - arrays whose items all carry a `code` merge item by item on `code`; new codes append
//   - `verify` notes accumulate (a parent's open questions still apply to the child)
//   - any other value, including other arrays and explicit nulls, is replaced

export const packKey = (code: string, version: string) => `${code}@${version}`;

export class PackError extends Error {
  constructor(
    readonly key: string,
    message: string,
  ) {
    super(`rule pack ${key}: ${message}`);
    this.name = 'PackError';
  }
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isObject = (v: unknown): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isCodedArray = (v: unknown): v is Array<{ code: string } & Record<string, Json>> =>
  Array.isArray(v) && v.every((x) => isObject(x) && typeof x.code === 'string');

function merge(base: Json | undefined, over: Json | undefined): Json | undefined {
  if (over === undefined) return base;
  if (isCodedArray(base) && isCodedArray(over)) {
    const out: Json[] = base.map((b) => {
      const o = over.find((x) => x.code === b.code);
      return o ? (merge(b, o) as Json) : b;
    });
    for (const o of over) if (!base.some((b) => b.code === o.code)) out.push(o);
    return out;
  }
  if (isObject(base) && isObject(over)) {
    const out: Record<string, Json> = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v) as Json;
    return out;
  }
  return over;
}

export function mergePack(parent: Pack, child: RawPack): Record<string, unknown> {
  const merged = merge(structuredClone(parent) as unknown as Json, structuredClone(child) as Json);
  const out = merged as Record<string, unknown>;
  const verify = [...(parent.verify ?? []), ...((child.verify as string[] | undefined) ?? [])];
  if (verify.length) out.verify = [...new Set(verify)];
  return out;
}

function formatIssues(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

/** Validates and resolves a set of raw pack documents. Throws PackError on the first bad pack. */
export function resolvePacks(rawDocs: readonly unknown[]): Map<string, Pack> {
  const raw = new Map<string, RawPack>();
  for (const doc of rawDocs) {
    const parsed = RawPackSchema.safeParse(doc);
    if (!parsed.success) throw new PackError('(unnamed)', `\n${formatIssues(parsed.error)}`);
    const key = packKey(parsed.data.code, parsed.data.version);
    if (raw.has(key)) throw new PackError(key, 'defined twice');
    raw.set(key, parsed.data);
  }

  const resolved = new Map<string, Pack>();
  const inProgress = new Set<string>();

  const resolve = (key: string): Pack => {
    const done = resolved.get(key);
    if (done) return done;
    if (inProgress.has(key)) throw new PackError(key, 'extends itself (cycle)');
    const doc = raw.get(key);
    if (!doc) throw new PackError(key, 'not found');

    inProgress.add(key);
    const input = doc.extends ? mergePack(resolve(packKey(doc.extends.code, doc.extends.version)), doc) : doc;
    const parsed = PackSchema.safeParse(input);
    if (!parsed.success) throw new PackError(key, `invalid after merge:\n${formatIssues(parsed.error)}`);
    inProgress.delete(key);

    resolved.set(key, parsed.data);
    return parsed.data;
  };

  for (const key of raw.keys()) resolve(key);
  return resolved;
}
