import type { Tx } from '@bhoomisetu/db';
import { Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { notify, responsiblePosts } from '../notifications/notify';
import { RulesService } from '../rules/rules.service';
import { MvRefresh } from './mv-refresh.service';

export interface DomainEventJob {
  outboxId: number;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}

/** An anchor-worthy event is handed to the chain module (Phase 4) through this hook. */
export type AnchorHook = (tx: Tx, e: DomainEventJob) => Promise<void>;

async function q<T>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  return ((await tx.execute(query)) as unknown as { rows: T[] }).rows;
}

/**
 * Consumers of domain events (§12.8): notify, transfer-freeze, mv-refresh, anchor. Idempotent — a
 * redelivered event produces no duplicate side effects (notifications dedupe; freezes use coalesce).
 */
@Injectable()
export class EventHandlers {
  private readonly logger = new Logger('Events');
  private anchorHook: AnchorHook | null = null;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly rules: RulesService,
    private readonly clock: ClockService,
    private readonly mv: MvRefresh,
  ) {}

  setAnchorHook(h: AnchorHook) {
    this.anchorHook = h;
  }

  async handle(e: DomainEventJob): Promise<void> {
    await this.worker.transaction(this.clock.now(), async (tx) => {
      await this.dispatch(tx, e);
      if (this.anchorHook) await this.anchorHook(tx, e);
    });
    if (
      [
        'STAGE_APPROVED',
        'DISBURSEMENT_SUCCEEDED',
        'COMPENSATION_ACKNOWLEDGED',
        'POSSESSION_TAKEN',
        'PROJECT_SUBMITTED',
        'AWARD_SIGNED',
        'ENTITLEMENT_PAID',
      ].includes(e.type)
    ) {
      this.mv.soon();
    }
  }

  private projectOf(e: DomainEventJob): string | null {
    const p = e.payload.projectId;
    return typeof p === 'string' ? p : e.aggregateType === 'project' ? e.aggregateId : null;
  }

  private async dispatch(tx: Tx, e: DomainEventJob) {
    const projectId = this.projectOf(e);
    const proj = projectId
      ? (
          await q<{ code: string; name: string; rule_pack_code: string | null; rule_pack_version: string | null }>(
            tx,
            sql`SELECT code, name, rule_pack_code, rule_pack_version FROM projects WHERE id = ${projectId}`,
          )
        )[0]
      : undefined;
    const pack = proj?.rule_pack_code ? this.rules.get(proj.rule_pack_code, proj.rule_pack_version!) : undefined;
    const link = projectId ? `/projects/${projectId}` : undefined;
    const tag = proj ? `${proj.code}` : '';

    switch (e.type) {
      case 'PROJECT_SUBMITTED': {
        const roles =
          pack?.governingAct === 'NH_ACT_1956' ? ['COLLECTOR', 'STATE_REVENUE', 'LAO'] : ['COLLECTOR', 'STATE_REVENUE'];
        for (const role of roles) {
          const ids =
            role === 'COLLECTOR'
              ? await this.allDistrictPosts(tx, projectId!, 'COLLECTOR')
              : await responsiblePosts(tx, projectId!, [role]);
          for (const id of ids)
            await notify(tx, {
              recipientPostId: id,
              trigger: 'PROJECT_SUBMITTED',
              severity: 'info',
              entityType: 'project',
              entityId: projectId!,
              title: `New proposal ${tag}: ${proj?.name}`,
              body: 'A requiring body submitted a land acquisition proposal in your jurisdiction.',
              deepLink: link,
              email: true,
            });
        }
        return;
      }
      case 'STAGE_SUBMITTED': {
        const stage = pack?.stages.find((s) => s.code === e.payload.stageCode);
        const roles = stage?.actions.APPROVE?.roles ?? [];
        for (const id of await responsiblePosts(tx, projectId!, roles)) {
          await notify(tx, {
            recipientPostId: id,
            trigger: 'STAGE_ASSIGNED',
            severity: 'info',
            entityType: 'stage_instance',
            entityId: String(e.payload.stageInstanceId),
            title: `${tag}: ${stage?.name ?? e.payload.stageCode} awaits your decision`,
            deepLink: link,
          });
        }
        return;
      }
      case 'STAGE_APPROVED': {
        const opened = await q<{ id: string; stage_code: string }>(
          tx,
          sql`SELECT id, stage_code FROM stage_instances WHERE project_id = ${projectId} AND status = 'IN_PROGRESS'`,
        );
        for (const o of opened) {
          const stage = pack?.stages.find((s) => s.code === o.stage_code);
          const roles = stage?.actions.SUBMIT?.roles ?? (stage ? [stage.ownerRole] : []);
          for (const id of await responsiblePosts(tx, projectId!, roles)) {
            await notify(tx, {
              recipientPostId: id,
              trigger: 'STAGE_ASSIGNED',
              severity: 'info',
              entityType: 'stage_instance',
              entityId: o.id,
              title: `${tag}: ${stage?.name ?? o.stage_code} is open`,
              deepLink: link,
            });
          }
        }
        return;
      }
      case 'STAGE_RETURNED': {
        const sub = await q<{ submitted_by_post_id: string | null; stage_code: string }>(
          tx,
          sql`SELECT submitted_by_post_id, stage_code FROM stage_instances WHERE id = ${String(e.payload.stageInstanceId)}`,
        );
        const post = sub[0]?.submitted_by_post_id;
        if (post)
          await notify(tx, {
            recipientPostId: post,
            trigger: 'STAGE_RETURNED',
            severity: 'warn',
            entityType: 'stage_instance',
            entityId: String(e.payload.stageInstanceId),
            title: `${tag}: ${sub[0]!.stage_code} returned (${String(e.payload.reasonCode ?? '')})`,
            deepLink: link,
            email: true,
          });
        return;
      }
      case 'S11_PUBLISHED': {
        // s.11: no transaction on the notified land without the Collector's permission.
        await tx.execute(sql`UPDATE land_parcels SET transfer_frozen_at = coalesce(transfer_frozen_at, app_now())
                             WHERE id IN (SELECT parcel_id FROM project_parcels WHERE project_id = ${projectId})`);
        await tx.execute(
          sql`UPDATE project_parcels SET status = 'CONSENT_ACQUIRED_NOTIFIED' WHERE project_id = ${projectId} AND status IN ('PROPOSED','VERIFICATION_PENDING','VERIFIED')`,
        );
        return;
      }
      case 'S19_PUBLISHED': {
        await tx.execute(
          sql`UPDATE project_parcels SET status = 'CLEARED_FOR_AWARD_RNR' WHERE project_id = ${projectId} AND status = 'CONSENT_ACQUIRED_NOTIFIED'`,
        );
        return;
      }
      case 'AWARD_SIGNED': {
        if (e.aggregateType === 'project')
          await tx.execute(
            sql`UPDATE project_parcels SET status = 'AWARDED' WHERE project_id = ${projectId} AND status = 'CLEARED_FOR_AWARD_RNR'`,
          );
        return;
      }
      case 'DISBURSEMENT_FAILED': {
        const p = (
          await q<{ project_id: string }>(
            tx,
            sql`SELECT af.project_id FROM entitlements e JOIN affected_families af ON af.id = e.affected_family_id WHERE e.id = ${String(e.payload.entitlementId)}`,
          )
        )[0];
        if (!p) return;
        for (const id of await responsiblePosts(tx, p.project_id, ['LAO', 'TREASURY_OFFICER'])) {
          await notify(tx, {
            recipientPostId: id,
            trigger: 'DISBURSEMENT_FAILED',
            severity: 'warn',
            entityType: 'disbursement',
            entityId: e.aggregateId,
            title: 'A compensation payment failed',
            body: 'Retry, correct the bank details or deposit with the Authority (s.77).',
            email: true,
          });
        }
        return;
      }
      case 'ACK_DISPUTED': {
        for (const id of await responsiblePosts(tx, projectId!, ['COLLECTOR'])) {
          await notify(tx, {
            recipientPostId: id,
            trigger: 'ACK_DISPUTED',
            severity: 'critical',
            entityType: 'disbursement',
            entityId: e.aggregateId,
            title: `${tag}: a family reports it did NOT receive a payment`,
            deepLink: link,
            email: true,
            sms: true,
          });
        }
        return;
      }
      case 'OBJECTION_FILED': {
        for (const id of await responsiblePosts(tx, projectId!, ['LAO'])) {
          await notify(tx, {
            recipientPostId: id,
            trigger: 'OBJECTION_FILED',
            severity: 'info',
            entityType: 'objection',
            entityId: e.aggregateId,
            title: `${tag}: objection filed`,
            deepLink: link,
          });
        }
        return;
      }
      case 'FIELD_SURVEY_SUBMITTED': {
        for (const id of await responsiblePosts(tx, projectId!, ['TEHSILDAR', 'DILR'])) {
          await notify(tx, {
            recipientPostId: id,
            trigger: 'VERIFICATION_PENDING',
            severity: 'info',
            entityType: 'field_survey',
            entityId: e.aggregateId,
            title: `${tag}: a walked parcel awaits verification`,
            deepLink: e.payload.parcelId ? `/parcels/${String(e.payload.parcelId)}` : link,
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private async allDistrictPosts(tx: Tx, projectId: string, role: string) {
    const r = await q<{ id: string }>(
      tx,
      sql`SELECT po.id FROM posts po WHERE po.is_active AND po.role::text = ${role} AND po.jurisdiction_level = 'DISTRICT' AND po.district_code = ANY(project_district_codes(${projectId}::uuid))`,
    );
    return r.map((x) => x.id);
  }
}
