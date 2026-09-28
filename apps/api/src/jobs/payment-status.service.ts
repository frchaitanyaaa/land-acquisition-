import { disbursements, entitlements } from '@bhoomisetu/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { PaymentService } from '../adapters/payment/payment.adapter';
import { SmsService } from '../adapters/sms/sms.adapter';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { writeOutbox } from '../common/outbox/outbox';
import { DisbursementService } from '../disbursement/disbursement.service';

const TICK_MS = 2_000;

/**
 * payment-status (§31): polls the payment adapter for PENDING disbursements not on hold, flips
 * them to SUCCESS / FAILED, and on success satisfies the payment clock, emits
 * DISBURSEMENT_SUCCEEDED and sends the family an acknowledgement link (mock SMS).
 */
@Injectable()
export class PaymentStatusJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('PaymentStatus');
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly payments: PaymentService,
    private readonly sms: SmsService,
    private readonly disb: DisbursementService,
    private readonly clock: ClockService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), TICK_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.run();
    } catch (e) {
      this.logger.warn((e as Error).message);
    } finally {
      this.busy = false;
    }
  }

  async run(): Promise<number> {
    const now = this.clock.now();
    return this.worker.transaction(now, async (tx) => {
      const pending = await tx
        .select()
        .from(disbursements)
        .where(
          and(
            eq(disbursements.paymentStatus, 'PENDING'),
            isNull(disbursements.holdReasonCode),
            eq(disbursements.adapterProvider, 'MOCK'),
          ),
        )
        .limit(50)
        .for('update', { skipLocked: true });
      let n = 0;
      for (const d of pending) {
        if (!d.adapterRef) continue;
        const r = await this.payments.status(d.adapterRef);
        if (r.status === 'PENDING') continue;
        n++;
        if (r.status === 'FAILED') {
          await tx.update(disbursements).set({ paymentStatus: 'FAILED' }).where(eq(disbursements.id, d.id));
          await writeOutbox(tx, {
            type: 'DISBURSEMENT_FAILED',
            aggregateType: 'disbursement',
            aggregateId: d.id,
            payload: { disbursementId: d.id, entitlementId: d.entitlementId },
          });
          continue;
        }
        await tx
          .update(disbursements)
          .set({ paymentStatus: 'SUCCESS', paidOn: now.toISOString().slice(0, 10) })
          .where(eq(disbursements.id, d.id));
        const [e] = await tx
          .select({
            id: entitlements.id,
            amount: entitlements.amountAwardedPaise,
            familyId: entitlements.affectedFamilyId,
          })
          .from(entitlements)
          .where(eq(entitlements.id, d.entitlementId));
        const paid = await tx.execute(
          sql`SELECT coalesce(sum(amount_paise),0)::text AS s FROM disbursements WHERE entitlement_id = ${d.entitlementId} AND payment_status = 'SUCCESS'`,
        );
        const paidSum = BigInt((paid as unknown as { rows: Array<{ s: string }> }).rows[0]!.s);
        const project = await tx.execute(sql`SELECT project_id FROM affected_families WHERE id = ${e!.familyId}`);
        const projectId = (project as unknown as { rows: Array<{ project_id: string }> }).rows[0]!.project_id;
        if (paidSum >= e!.amount) {
          await tx
            .update(entitlements)
            .set({ status: d.acceptanceType === 'UNDER_PROTEST' ? 'UNDER_PROTEST' : 'DISBURSED' })
            .where(eq(entitlements.id, d.entitlementId));
          await this.disb.onPaid(tx, projectId, d.entitlementId, now);
        }
        await writeOutbox(tx, {
          type: 'DISBURSEMENT_SUCCEEDED',
          aggregateType: 'disbursement',
          aggregateId: d.id,
          payload: {
            disbursementId: d.id,
            entitlementId: d.entitlementId,
            amountPaise: d.amountPaise,
            instrument: d.instrument,
            paidOn: now.toISOString().slice(0, 10),
            adapterRef: d.adapterRef,
            projectId,
          },
        });
        const link = await this.disb.issueAckLink(tx, d.id, null);
        const phone = await tx.execute(sql`SELECT phone_masked FROM persons WHERE id = ${link.personId}`);
        await this.sms.send(tx, {
          to: (phone as unknown as { rows: Array<{ phone_masked: string | null }> }).rows[0]?.phone_masked ?? null,
          template: 'ACK_REQUESTED',
          body: `BhoomiSetu: a payment has been made to you. Please confirm receipt: ${link.url}`,
        });
      }
      return n;
    });
  }
}
