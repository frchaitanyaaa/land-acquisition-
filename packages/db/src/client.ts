import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, types, type PoolConfig } from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Db = NodePgDatabase<Schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

const TEXT_ARRAY_OID = 1009;

/**
 * node-pg only knows the parsers for built-in array types (int4[], text[], …); a custom enum's
 * array type (parcel_status[], parcel_flag[], …) gets a dynamically-assigned OID per database,
 * so pg falls back to returning the wire-format literal as a raw string ("{A,B}") instead of a JS
 * array — silently, for every raw-SQL query (rows()/one()) that selects or array_aggs one. Fixed
 * once, globally, by discovering every enum array OID and pointing it at the same parser text[]
 * already uses (enum arrays serialise identically to text arrays in the wire protocol).
 */
let enumArraysRegistered: Promise<void> | null = null;
async function registerEnumArrayParsers(pool: Pool): Promise<void> {
  const { rows } = await pool.query<{ typarray: number }>(
    "SELECT typarray FROM pg_type WHERE typtype = 'e' AND typarray <> 0",
  );
  // pg's TypeId type only names its own well-known builtin OIDs; 1009 (text[]) is one of them,
  // but TS doesn't expose that constant for reuse here, so the literal is cast at the boundary.
  const parseTextArray = types.getTypeParser(TEXT_ARRAY_OID as Parameters<typeof types.getTypeParser>[0]);
  for (const { typarray } of rows)
    types.setTypeParser(typarray as Parameters<typeof types.setTypeParser>[0], parseTextArray);
}

export function createPool(connectionString: string, config: PoolConfig = {}): Pool {
  const pool = new Pool({ connectionString, ...config });
  enumArraysRegistered ??= registerEnumArrayParsers(pool).catch((e: Error) => {
    enumArraysRegistered = null; // retry on the next pool if this attempt failed (e.g. DB not ready yet)
    throw e;
  });
  return pool;
}

/** Callers that read a raw query's rows directly (rows()/one() in apps/api) await this first, so
 * the very first query on a freshly-booted process never races the enum-array parser setup. */
export function whenEnumArrayParsersReady(): Promise<void> {
  return enumArraysRegistered ?? Promise.resolve();
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema, casing: 'snake_case' });
}
