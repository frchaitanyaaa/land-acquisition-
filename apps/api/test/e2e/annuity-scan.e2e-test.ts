import { affectedFamilies, annuitySchedules, entitlements, notifications, postAssignments, posts, users } from '@bhoomisetu/db';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { AnnuityScan } from '../../src/jobs/annuity-scan.service';
import { bootApp, closeApp, closeDb, testDb } from './harness';

// Exercises the annuity-scan job built for this prompt (§31, §23, §28): a `scheduled` instalment
// past due_on with no linked disbursement is marked `missed` and notifies the responsible
// RNR_ADMINISTRATOR post exactly once, even across repeated scans (notify() dedupes on
// (recipient, trigger, entity, level), §28).
//
// The seed has no overdue `scheduled` annuity row (its schedules are all either already `paid` or
// due in the future relative to the frozen DEMO_NOW), so this test seeds one itself directly, plus
// a temporary PROJECT-level RNR_ADMINISTRATOR post to receive the notification — both removed in
// afterAll. Fixture project: RJ-BHD-2025-010 (not a named demo hook, §33.6).
const PROJECT_ID = 'd4feb17f-3cc3-4575-910c-764afc7ee440';

describe('annuity-scan job', () => {
  let app: INestApplication;
  let annuityId: string;
  let postId: string;

  beforeAll(async () => {
    app = await bootApp();
    const db = testDb();

    const [entitlement] = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .innerJoin(affectedFamilies, eq(affectedFamilies.id, entitlements.affectedFamilyId))
      .where(and(eq(affectedFamilies.projectId, PROJECT_ID)))
      .limit(1);
    expect(entitlement).toBeTruthy();

    const [post] = await db
      .insert(posts)
      .values({
        designation: 'e2e RNR Administrator',
        role: 'RNR_ADMINISTRATOR',
        jurisdictionLevel: 'PROJECT',
        projectId: PROJECT_ID,
        isActive: true,
      })
      .returning({ id: posts.id });
    postId = post!.id;
    const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.email, 'admin@bhoomisetu.local'));
    await db.insert(postAssignments).values({ postId, userId: admin!.id, validFrom: new Date() });

    const [row] = await db
      .insert(annuitySchedules)
      .values({
        entitlementId: entitlement!.id,
        instalmentNo: 999,
        dueOn: '2020-01-01',
        amountPaise: 200_000n,
        status: 'scheduled',
      })
      .returning({ id: annuitySchedules.id });
    annuityId = row!.id;
  }, 60_000);

  afterAll(async () => {
    const db = testDb();
    await db.delete(notifications).where(eq(notifications.recipientPostId, postId));
    await db.delete(annuitySchedules).where(eq(annuitySchedules.id, annuityId));
    await db.delete(postAssignments).where(eq(postAssignments.postId, postId));
    await db.delete(posts).where(eq(posts.id, postId));
    await closeApp();
    await closeDb();
  });

  it('marks the overdue scheduled instalment missed and notifies once', async () => {
    const job = app.get(AnnuityScan);
    const n1 = await job.scan();
    expect(n1).toBeGreaterThanOrEqual(1);

    const db = testDb();
    const [after] = await db.select().from(annuitySchedules).where(eq(annuitySchedules.id, annuityId));
    expect(after!.status).toBe('missed');

    const notifs = await db.select().from(notifications).where(eq(notifications.recipientPostId, postId));
    expect(notifs).toHaveLength(1);
    expect(notifs[0]!.trigger).toBe('ANNUITY_MISSED');
  });

  it('is idempotent — a second scan does not double-notify', async () => {
    const job = app.get(AnnuityScan);
    await job.scan();
    const db = testDb();
    const notifs = await db.select().from(notifications).where(eq(notifications.recipientPostId, postId));
    expect(notifs).toHaveLength(1);
  });
});
