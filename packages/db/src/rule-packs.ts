import type { Pack } from '@bhoomisetu/rules';
import { packChecksum } from '@bhoomisetu/rules/fs';
import { and, eq } from 'drizzle-orm';
import type { DbOrTx } from './client';
import { rulePacks } from './schema';

export class RulePackImmutableError extends Error {
  constructor(key: string, stored: string, onDisk: string) {
    super(
      `rule pack ${key} is published and immutable: the database holds checksum ${stored.slice(0, 12)}… ` +
        `but the file resolves to ${onDisk.slice(0, 12)}…. Publish the change as a new version.`,
    );
    this.name = 'RulePackImmutableError';
  }
}

/**
 * Upserts resolved packs into rule_packs (§10.3). A (code, version) already stored with a
 * different checksum is an error — a published version never changes (§12.1). Needs a
 * connection that may write rule_packs (app_worker / seed).
 */
export async function syncRulePacks(
  db: DbOrTx,
  packs: Map<string, Pack>,
): Promise<{ inserted: string[]; unchanged: string[] }> {
  const inserted: string[] = [];
  const unchanged: string[] = [];

  for (const [key, pack] of packs) {
    const checksum = packChecksum(pack);
    const [existing] = await db
      .select({ checksum: rulePacks.checksum })
      .from(rulePacks)
      .where(and(eq(rulePacks.code, pack.code), eq(rulePacks.version, pack.version)));

    if (existing) {
      if (existing.checksum !== checksum) throw new RulePackImmutableError(key, existing.checksum, checksum);
      unchanged.push(key);
      continue;
    }

    await db.insert(rulePacks).values({
      code: pack.code,
      version: pack.version,
      title: pack.title,
      governingAct: pack.governingAct,
      jurisdictionLevel: pack.jurisdiction.level,
      stateCode: pack.jurisdiction.stateCode ?? null,
      extendsCode: pack.extends?.code ?? null,
      extendsVersion: pack.extends?.version ?? null,
      effectiveFrom: pack.effectiveFrom,
      effectiveTo: pack.effectiveTo ?? null,
      definition: pack,
      checksum,
    });
    inserted.push(key);
  }
  return { inserted, unchanged };
}
