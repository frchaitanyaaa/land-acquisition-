import { chainEvents, type Tx } from '@bhoomisetu/db';
import { Injectable, Logger } from '@nestjs/common';
import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import { env } from '../config/env';
import { anchorKey, anchorTarget, buildPayload, dataHash, type AnchorEntity } from './payloads';

export const ANCHOR_ABI = [
  'function anchor(bytes32 key, uint32 version, bytes32 dataHash, string eventType)',
  'function anchorBatch(bytes32[] keys, uint32[] versions, bytes32[] hashes, string[] eventTypes)',
  'function getAnchor(bytes32 key, uint32 version) view returns (tuple(bytes32 dataHash, uint64 anchoredAt, address anchorer, string eventType))',
  'function latestVersion(bytes32 key) view returns (uint32)',
];

const READ_TIMEOUT_MS = 3_000;
export const MAX_ATTEMPTS = 10;

const ENTITIES: readonly AnchorEntity[] = [
  'land_parcel',
  'stage_instance',
  'award',
  'disbursement',
  'acknowledgement',
  'project_parcel',
  'document',
  'webauthn_credential',
];

const timeout = <T>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, r) => setTimeout(() => r(new Error('chain timeout')), ms))]);

/** Trust layer (§27). Anchoring is NEVER in the request path (G5); verify only READS the chain. */
@Injectable()
export class ChainService {
  private readonly logger = new Logger('Chain');
  private provider: JsonRpcProvider | null = null;

  constructor(private readonly db: DbService) {}

  configured(): boolean {
    return !!env().CHAIN_ANCHOR_CONTRACT;
  }

  private rpc(): JsonRpcProvider {
    this.provider ??= new JsonRpcProvider(env().CHAIN_RPC_URL, undefined, { staticNetwork: true });
    return this.provider;
  }

  contract(withSigner = false): Contract {
    const address = env().CHAIN_ANCHOR_CONTRACT;
    if (!address) throw new Error('CHAIN_ANCHOR_CONTRACT is not set — run pnpm chain:deploy');
    const runner = withSigner ? new Wallet(env().CHAIN_RELAYER_PRIVATE_KEY ?? '', this.rpc()) : this.rpc();
    return new Contract(address, ANCHOR_ABI, runner);
  }

  /**
   * Worker-side hook for anchor-worthy outbox events: builds the canonical payload from the
   * human-approved record (G4) and queues it. Runs inside the event handler's worker transaction.
   */
  async enqueue(
    tx: Tx,
    e: { type: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> },
  ) {
    const t = anchorTarget(e);
    if (!t) return;
    const built = await buildPayload(tx, t.entityType, t.entityId, t.version);
    if (!built) return;
    await tx
      .insert(chainEvents)
      .values({
        entityType: t.entityType,
        entityId: t.entityId,
        entityVersion: t.version,
        eventType: built.eventType,
        canonicalPayload: built.payload,
        dataHash: dataHash(built.payload),
        status: 'QUEUED',
      })
      .onConflictDoNothing();
  }

  /** One anchoring pass: QUEUED rows (and FAILED ones under the retry cap, with backoff), oldest first. */
  async anchorPending(tx: Tx, batch = 20): Promise<number> {
    if (!this.configured()) return 0;
    const rows = await tx
      .select()
      .from(chainEvents)
      .where(and(inArray(chainEvents.status, ['QUEUED', 'FAILED']), lt(chainEvents.attempts, MAX_ATTEMPTS)))
      .orderBy(asc(chainEvents.createdAt))
      .limit(batch)
      .for('update', { skipLocked: true });
    const c = this.contract(true);
    let n = 0;
    // Backlog (seed, chain outage): one anchorBatch for fresh rows (§33.1 fast path).
    const fresh = rows.filter((r) => r.status === 'QUEUED');
    if (fresh.length >= 5) {
      try {
        const txr = await c.getFunction('anchorBatch')(
          fresh.map((r) => anchorKey(r.entityType, r.entityId)),
          fresh.map((r) => r.entityVersion),
          fresh.map((r) => r.dataHash),
          fresh.map((r) => r.eventType),
        );
        const receipt = await txr.wait(env().CHAIN_CONFIRMATIONS);
        await tx
          .update(chainEvents)
          .set({
            status: 'ANCHORED',
            txHash: txr.hash,
            blockNumber: receipt?.blockNumber ?? null,
            anchoredAt: new Date(),
            lastError: null,
          })
          .where(
            inArray(
              chainEvents.id,
              fresh.map((r) => r.id),
            ),
          );
        return fresh.length;
      } catch (err) {
        this.logger.warn(
          `batch anchor failed, falling back to single anchors: ${(err as Error).message.slice(0, 160)}`,
        );
      }
    }
    for (const r of rows) {
      // Exponential backoff for failures: 2^attempts seconds since the last update.
      if (r.status === 'FAILED' && r.updatedAt && Date.now() - r.updatedAt.getTime() < 2 ** r.attempts * 1000) continue;
      try {
        const txr = await c.getFunction('anchor')(
          anchorKey(r.entityType, r.entityId),
          r.entityVersion,
          r.dataHash,
          r.eventType,
        );
        const receipt = await txr.wait(env().CHAIN_CONFIRMATIONS);
        await tx
          .update(chainEvents)
          .set({
            status: 'ANCHORED',
            txHash: txr.hash,
            blockNumber: receipt?.blockNumber ?? null,
            anchoredAt: new Date(),
            attempts: r.attempts + 1,
            lastError: null,
          })
          .where(eq(chainEvents.id, r.id));
        n++;
      } catch (err) {
        const msg = (err as Error).message;
        // Already anchored on chain (e.g. after a DB restore): treat as anchored if the hash matches.
        if (/version already anchored/.test(msg)) {
          const onChain = await this.readAnchor(r.entityType, r.entityId, r.entityVersion).catch(() => null);
          if (onChain?.dataHash === r.dataHash) {
            await tx
              .update(chainEvents)
              .set({ status: 'ANCHORED', attempts: r.attempts + 1, lastError: null, anchoredAt: new Date() })
              .where(eq(chainEvents.id, r.id));
            continue;
          }
        }
        await tx
          .update(chainEvents)
          .set({ status: 'FAILED', attempts: r.attempts + 1, lastError: msg.slice(0, 500) })
          .where(eq(chainEvents.id, r.id));
        this.logger.warn(`anchor ${r.entityType}:${r.entityId} v${r.entityVersion} failed: ${msg.slice(0, 200)}`);
        if (/ECONNREFUSED|timeout|network/i.test(msg)) break; // chain down: stop this pass
      }
    }
    return n;
  }

  /**
   * Enqueues human-approved records that carry no chain event yet (seeded data, or events handled
   * before the chain was configured). Idempotent: (entity_type, entity_id, version) is unique.
   */
  async backfill(tx: Tx): Promise<number> {
    const targets = (await tx.execute(sql`
      SELECT 'award' AS t, id, version AS v FROM awards WHERE status = 'signed'
      UNION ALL SELECT 'disbursement', id, 1 FROM disbursements WHERE payment_status = 'SUCCESS'
      UNION ALL SELECT 'acknowledgement', id, 1 FROM acknowledgements
      UNION ALL SELECT 'project_parcel', project_parcel_id, 1 FROM possession_events
      UNION ALL SELECT 'document', d.id, d.version FROM documents d JOIN attestations a ON a.document_id = d.id
      UNION ALL SELECT 'stage_instance', si.id, si.attempt FROM stage_instances si
        WHERE EXISTS (SELECT 1 FROM stage_transitions st WHERE st.stage_instance_id = si.id AND st.action IN ('APPROVE','APPROVE_CONDITIONAL','OVERRIDE'))
    `)) as unknown as { rows: Array<{ t: AnchorEntity; id: string; v: number }> };
    const existing = new Set(
      (
        (await tx.execute(
          sql`SELECT entity_type || ':' || entity_id || ':' || entity_version AS k FROM chain_events`,
        )) as unknown as { rows: Array<{ k: string }> }
      ).rows.map((r) => r.k),
    );
    let n = 0;
    for (const t of targets.rows) {
      if (existing.has(`${t.t}:${t.id}:${t.v}`)) continue;
      const built = await buildPayload(tx, t.t, t.id, t.v);
      if (!built) continue;
      await tx
        .insert(chainEvents)
        .values({
          entityType: t.t,
          entityId: t.id,
          entityVersion: t.v,
          eventType: built.eventType,
          canonicalPayload: built.payload,
          dataHash: dataHash(built.payload),
          status: 'QUEUED',
        })
        .onConflictDoNothing();
      n++;
    }
    return n;
  }

  async readAnchor(entityType: string, entityId: string, version: number) {
    const a = await timeout(
      this.contract().getFunction('getAnchor')(anchorKey(entityType, entityId), version),
      READ_TIMEOUT_MS,
    );
    const [hash, anchoredAt, anchorer, eventType] = a as [string, bigint, string, string];
    return { dataHash: hash, anchoredAt: Number(anchoredAt), anchorer, eventType };
  }

  /** §27.4: rebuild from the current row, hash, compare with the chain. */
  verify(user: AuthUser, entityType: string, entityId: string, version?: number) {
    if (!ENTITIES.includes(entityType as AnchorEntity))
      throw new ProblemException(404, 'ENTITY_TYPE_UNKNOWN', `Unknown anchored entity type ${entityType}.`);
    return this.db.withScope(user, async (tx) => {
      const events = await tx
        .select()
        .from(chainEvents)
        .where(and(eq(chainEvents.entityType, entityType), eq(chainEvents.entityId, entityId)))
        .orderBy(asc(chainEvents.entityVersion));
      const v = version ?? events.at(-1)?.entityVersion ?? 1;
      const ev = events.find((e) => e.entityVersion === v);
      const built = await buildPayload(tx, entityType as AnchorEntity, entityId, v);
      const currentHash = built ? dataHash(built.payload) : null;
      const base = {
        entityType,
        entityId,
        version: v,
        currentHash,
        lineage: events.map((e) => ({
          version: e.entityVersion,
          status: e.status,
          blockNumber: e.blockNumber,
          txHash: e.txHash,
          eventType: e.eventType,
        })),
      };
      if (!ev) return { ...base, result: 'NOT_ANCHORED' as const };
      if (ev.status !== 'ANCHORED')
        return { ...base, result: 'PENDING' as const, chainStatus: ev.status, lastError: ev.lastError };
      let onChain: Awaited<ReturnType<ChainService['readAnchor']>> | null = null;
      try {
        onChain = await this.readAnchor(entityType, entityId, v);
      } catch (err) {
        return { ...base, result: 'PENDING' as const, chainStatus: 'UNREACHABLE', lastError: (err as Error).message };
      }
      const result = onChain.dataHash === currentHash ? ('VERIFIED' as const) : ('MISMATCH' as const);
      return {
        ...base,
        result,
        anchoredHash: onChain.dataHash,
        blockNumber: ev.blockNumber,
        txHash: ev.txHash,
        anchoredAt: new Date(onChain.anchoredAt * 1000),
        eventType: onChain.eventType,
      };
    });
  }

  /** Ops panel: counts by status and the last failures. */
  status(user: AuthUser) {
    return this.db.withScope(user, async (tx) => ({
      configured: this.configured(),
      counts: (
        (await tx.execute(sql`SELECT status, count(*)::int AS n FROM chain_events GROUP BY status`)) as unknown as {
          rows: unknown[];
        }
      ).rows,
      failures: await tx
        .select()
        .from(chainEvents)
        .where(eq(chainEvents.status, 'FAILED'))
        .orderBy(asc(chainEvents.createdAt))
        .limit(20),
    }));
  }
}
