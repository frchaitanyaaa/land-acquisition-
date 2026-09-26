import { auditLog } from '@bhoomisetu/db';
import { Injectable } from '@nestjs/common';
import { ClockService } from '../clock/clock.service';
import { requestContext } from '../context/request-context';
import { DbService } from '../db/db.service';
import { toJsonSafe } from '../json';

export interface AuditEntry {
  /** e.g. STAGE_APPROVED, AUTH_LOGIN. */
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Defaults to the request's user and active post (G19). */
  actorUserId?: string | null;
  actorPostId?: string | null;
}

/**
 * Writes audit_log rows (G15). Call it from services inside the same withScope transaction as the
 * change, with before/after. The table is append-only and hash-chained by trigger (§11.6); request
 * handlers may insert but never read it back.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly db: DbService,
    private readonly clock: ClockService,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    const ctx = requestContext.get();
    const user = ctx?.user ?? null;

    await this.db.withScope(user, (tx) =>
      tx.insert(auditLog).values({
        at: this.clock.now(),
        actorUserId: entry.actorUserId ?? user?.id ?? null,
        actorPostId: entry.actorPostId ?? user?.post.id ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before === undefined ? null : toJsonSafe(entry.before),
        after: entry.after === undefined ? null : toJsonSafe(entry.after),
        ip: ctx?.ip ?? null,
        requestId: ctx?.requestId ?? null,
      }),
    );
    if (ctx) ctx.audited = true;
  }
}
