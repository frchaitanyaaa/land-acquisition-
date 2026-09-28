import { documents, ocrExtractions } from '@bhoomisetu/db';
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { and, eq, lt } from 'drizzle-orm';
import { PDFParse } from 'pdf-parse';
import { recognize } from 'tesseract.js';
import { StorageService } from '../adapters/storage/storage.adapter';
import { ClockService } from '../common/clock/clock.service';
import { WorkerDbService } from '../common/db/worker-db.service';
import { extractAwardFields, textTooThin } from './ocr-extract';

const TICK_MS = 3_000;
const MAX_ATTEMPTS = 10;

/**
 * ocr (§26.3, §31): pdf-parse first; if the text is too thin per page, falls back to tesseract.js
 * (eng+hin+mar) rasterising each page via pdf-parse's built-in screenshot renderer. Award upload
 * (award.service.ts `create`) only inserts the `ocr_extractions` row and returns — this job does
 * the slow work off the request path. Retry/backoff mirrors chain.service.ts's convention
 * (attempts + lastError, exponential backoff, capped retries). Only human-accepted fields ever
 * reach entitlements (G3); this job only ever writes `fields`/`status`, never `accepted`.
 */
@Injectable()
export class OcrJob implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('Ocr');
  private timer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(
    private readonly worker: WorkerDbService,
    private readonly storage: StorageService,
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
    const pending = await this.worker.transaction(now, (tx) =>
      tx
        .select()
        .from(ocrExtractions)
        .where(and(eq(ocrExtractions.status, 'pending'), lt(ocrExtractions.attempts, MAX_ATTEMPTS)))
        .limit(5)
        .for('update', { skipLocked: true }),
    );
    let n = 0;
    for (const p of pending) {
      // Exponential backoff for retries: 2^attempts seconds since the last attempt.
      if (p.attempts > 0 && p.updatedAt && Date.now() - p.updatedAt.getTime() < 2 ** p.attempts * 1000) continue;
      await this.process(p.id, p.documentId, p.attempts);
      n++;
    }
    return n;
  }

  private async process(extractionId: string, documentId: string, attempts: number) {
    try {
      const now = this.clock.now();
      const doc = await this.worker.transaction(now, async (tx) => {
        const [d] = await tx.select().from(documents).where(eq(documents.id, documentId));
        return d;
      });
      if (!doc) throw new Error(`document ${documentId} not found`);
      const buffer = await this.storage.get(doc.objectKey);

      const parser = new PDFParse({ data: buffer });
      let engine = 'pdf-parse';
      let pages: string[];
      try {
        const r = await parser.getText();
        pages = r.pages.map((page) => page.text);
        if (textTooThin(r.text, r.pages.length || 1)) {
          const rasterised = await this.tesseractFallback(parser);
          if (rasterised) {
            engine = 'tesseract';
            pages = rasterised;
          }
        }
      } finally {
        await parser.destroy();
      }

      const fields = extractAwardFields(pages);
      await this.worker.transaction(this.clock.now(), (tx) =>
        tx
          .update(ocrExtractions)
          .set({ engine, fields, status: 'ready', attempts: attempts + 1, lastError: null })
          .where(eq(ocrExtractions.id, extractionId)),
      );
    } catch (e) {
      const msg = (e as Error).message.slice(0, 500);
      this.logger.warn(`extraction ${extractionId} failed (attempt ${attempts + 1}): ${msg}`);
      await this.worker.transaction(this.clock.now(), (tx) =>
        tx
          .update(ocrExtractions)
          .set({ attempts: attempts + 1, lastError: msg })
          .where(eq(ocrExtractions.id, extractionId)),
      );
    }
  }

  /** Rasterises each page and runs tesseract.js; returns null (keep pdf-parse's thin text) on any failure. */
  private async tesseractFallback(parser: PDFParse): Promise<string[] | null> {
    try {
      const shots = await parser.getScreenshot({ imageBuffer: true });
      const out: string[] = [];
      for (const page of shots.pages) {
        if (!page.data) continue;
        const { data } = await recognize(Buffer.from(page.data), 'eng+hin+mar');
        out.push(data.text);
      }
      return out.length ? out : null;
    } catch (e) {
      this.logger.warn(`tesseract fallback unavailable: ${(e as Error).message}`);
      return null;
    }
  }
}
