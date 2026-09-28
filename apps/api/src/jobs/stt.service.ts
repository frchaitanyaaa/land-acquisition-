import { documents, hearings, objections, type Tx } from '@bhoomisetu/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { SttService } from '../adapters/stt/stt.adapter';
import { triageObjection } from '../consent/consent.service';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { writeOutbox } from '../common/outbox/outbox';

const TICK_MS = 5_000;

/**
 * stt (§17, §30, §31): transcribes a hearing's recording and splits it into one objection ticket
 * per segment, pre-triaged into ai_suggested_* only (G3 — an officer confirms the authoritative
 * ground/category via the existing ConsentService.classify()). Idempotent: a hearing recording is
 * only processed once (guarded by objections.transcript_document_id already existing for it).
 */
@Injectable()
export class SttJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Stt');
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly stt: SttService,
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
        .select({
          hearingId: hearings.id,
          projectId: hearings.projectId,
          recordingDocumentId: hearings.recordingDocumentId,
        })
        .from(hearings)
        .where(
          and(
            isNotNull(hearings.recordingDocumentId),
            ne(hearings.status, 'VOID'),
            sql`NOT EXISTS (SELECT 1 FROM objections o WHERE o.transcript_document_id = ${hearings.recordingDocumentId})`,
          ),
        )
        .limit(20)
        .for('update', { skipLocked: true });
      let n = 0;
      for (const h of pending) {
        await this.processHearing(tx, h.hearingId, h.projectId, h.recordingDocumentId!);
        n++;
      }
      return n;
    });
  }

  private async processHearing(tx: Tx, hearingId: string, projectId: string, recordingDocumentId: string) {
    const [doc] = await tx.select().from(documents).where(eq(documents.id, recordingDocumentId));
    if (!doc) return;
    const now = this.clock.now();
    const transcript = await this.stt.transcribe({ id: doc.id, objectKey: doc.objectKey });
    for (const seg of transcript.segments) {
      if (!seg.text.trim()) continue;
      const suggestion = triageObjection(seg.text);
      const [o] = await tx
        .insert(objections)
        .values({
          projectId,
          personId: null,
          parcelId: null,
          channel: 'hearing_audio',
          filedAt: now,
          language: transcript.language,
          body: seg.text,
          transcriptDocumentId: recordingDocumentId,
          aiSuggestedGround: suggestion.ground,
          aiSuggestedCategory: suggestion.category,
          aiConfidence: String(suggestion.confidence),
          status: 'FILED',
        })
        .returning();
      if (!o) continue;
      await writeOutbox(tx, {
        type: 'OBJECTION_FILED',
        aggregateType: 'objection',
        aggregateId: o.id,
        payload: { projectId, channel: 'hearing_audio', hearingId, segmentIndex: seg.index },
      });
    }
  }
}
