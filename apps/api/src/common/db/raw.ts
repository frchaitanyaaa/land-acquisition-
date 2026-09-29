import { whenEnumArrayParsersReady, type Tx } from '@bhoomisetu/db';
import type { SQL } from 'drizzle-orm';

/** Runs a raw SQL query (PostGIS-heavy work) inside the scoped transaction and returns its rows.
 * Waits once for the enum-array type-parser registration (packages/db/src/client.ts) so a raw
 * `array_agg(enum_col)` or a plain enum[] column never comes back as a Postgres literal string. */
export async function rows<T>(tx: Tx, query: SQL): Promise<T[]> {
  await whenEnumArrayParsersReady();
  const res = (await tx.execute(query)) as unknown as { rows: T[] };
  return res.rows;
}

export async function one<T>(tx: Tx, query: SQL): Promise<T | undefined> {
  return (await rows<T>(tx, query))[0];
}
