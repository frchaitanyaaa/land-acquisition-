import type { Tx } from '@bhoomisetu/db';
import type { SQL } from 'drizzle-orm';

/** Runs a raw SQL query (PostGIS-heavy work) inside the scoped transaction and returns its rows. */
export async function rows<T>(tx: Tx, query: SQL): Promise<T[]> {
  const res = (await tx.execute(query)) as unknown as { rows: T[] };
  return res.rows;
}

export async function one<T>(tx: Tx, query: SQL): Promise<T | undefined> {
  return (await rows<T>(tx, query))[0];
}
