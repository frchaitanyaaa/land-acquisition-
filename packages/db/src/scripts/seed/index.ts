import { createHash } from 'node:crypto';
import { loadPacks } from '@bhoomisetu/rules/fs';
import argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { createDb, createPool } from '../../client';
import { syncRulePacks } from '../../rule-packs';
import * as s from '../../schema';
import {
  DEMO_PASSWORD,
  DISTRICTS,
  POSTS,
  PROJECTS,
  REQUIRING_BODIES,
  STATES,
  SUB_DISTRICTS,
  USERS,
  VILLAGES,
} from './fixtures';
import { replayHistory } from './history';
import { seedV1, type SeedCtx } from './v1';

// Deterministic by construction (§9, §33.1): ids are hashed from SEED + a stable name, every date
// is an offset from DEMO_NOW, and password salts derive from the email. Two runs → same database.

const DAY_MS = 86_400_000;

/** A v4-shaped uuid derived from (seed, name) — stable across runs and independent of insert order. */
export function seedId(seed: string, name: string): string {
  const h = createHash('sha256').update(`bhoomisetu:${seed}:${name}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x40;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** Refreshes the materialised KPI views as their owner, at the given clock. */
export const REFRESH_SQL = `
  REFRESH MATERIALIZED VIEW mv_district_kpis;
  REFRESH MATERIALIZED VIEW mv_state_kpis;
  REFRESH MATERIALIZED VIEW mv_national_kpis;
  REFRESH MATERIALIZED VIEW mv_interest_liability;
`;

export async function runSeed(workerUrl: string, opts: { now: Date; seed: string }): Promise<void> {
  const { now, seed } = opts;
  const id = (name: string) => seedId(seed, name);
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);

  const pool = createPool(workerUrl, { max: 1 });
  const db = createDb(pool);
  try {
    const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM states');
    if (rows[0]!.n > 0) throw new Error('database is already seeded — run `pnpm db:reset` instead');

    const packs = loadPacks();
    const passwordHash = (email: string) =>
      argon2.hash(DEMO_PASSWORD, {
        type: argon2.argon2id,
        salt: createHash('sha256').update(`salt:${seed}:${email}`).digest().subarray(0, 16),
      });
    const hashes = new Map(await Promise.all(USERS.map(async (u) => [u.email, await passwordHash(u.email)] as const)));

    let summary: Record<string, unknown> = {};
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.now', ${now.toISOString()}, true)`);

      await tx.insert(s.states).values(STATES);
      await tx.insert(s.districts).values(DISTRICTS);
      await tx.insert(s.subDistricts).values(SUB_DISTRICTS);
      await tx.insert(s.villages).values(VILLAGES.map((v) => ({ ...v, dataSource: 'SYNTHETIC_DEMO' as const })));

      await syncRulePacks(tx, packs);

      await tx
        .insert(s.requiringBodies)
        .values(REQUIRING_BODIES.map(({ key, ...rb }) => ({ id: id(`requiring_body:${key}`), ...rb })));

      const seeded: SeedCtx['projects'] = [];
      for (const p of PROJECTS) {
        const projectId = id(`project:${p.code}`);
        const pack = packs.get(`${p.pack.code}@${p.pack.version}`);
        if (!pack) throw new Error(`${p.code}: pack ${p.pack.code}@${p.pack.version} not found`);
        const history = replayHistory(pack, p, now);
        await tx.insert(s.projects).values({
          id: projectId,
          code: p.code,
          name: p.name,
          nameLocal: p.nameLocal,
          category: p.category,
          subCategory: p.subCategory,
          acquisitionType: p.acquisitionType,
          requiringBodyId: id(`requiring_body:${p.requiringBody}`),
          nationalImportance: p.nationalImportance,
          estimatedBudgetPaise: p.budgetRupees * 100n,
          rulePackCode: p.pack.code,
          rulePackVersion: p.pack.version,
          stateCode: p.stateCode,
          isLinear: p.isLinear,
          rowWidthM: p.rowWidthM,
          isUrgency: p.isUrgency ?? false,
          inScheduledArea: p.inScheduledArea ?? false,
          status: history.projectStatus,
          currentStage: p.currentStage,
          submittedAt: daysAgo(p.submittedDaysAgo),
          dataSource: 'SYNTHETIC_DEMO',
        });
        await tx.insert(s.projectDistricts).values(p.districts.map((districtCode) => ({ projectId, districtCode })));
        const stageId = (code: string, attempt: number) => id(`stage:${p.code}:${code}:${attempt}`);
        await tx
          .insert(s.stageInstances)
          .values(history.stages.map((st) => ({ id: stageId(st.stageCode, st.attempt), projectId, ...st })));
        if (history.deadlines.length) {
          await tx.insert(s.statutoryDeadlines).values(
            history.deadlines.map(({ subjectStage, ...d }) => ({
              id: id(`deadline:${p.code}:${d.clockCode}:${subjectStage ?? 'project'}`),
              projectId,
              ...d,
              subjectId: subjectStage ? stageId(subjectStage, 1) : projectId,
              rulePackCode: pack.code,
              rulePackVersion: pack.version,
              breachedAt: d.status === 'BREACHED' ? d.dueAt : null,
              conditionInputs: {},
            })),
          );
        }
        seeded.push({ fixture: p, projectId, stages: history.stages });
      }

      await tx.insert(s.posts).values(
        POSTS.map((p) => ({
          id: id(`post:${p.key}`),
          designation: p.designation,
          role: p.role,
          jurisdictionLevel: p.level,
          stateCode: p.stateCode ?? null,
          districtCode: p.districtCode ?? null,
          projectId: p.project ? id(`project:${p.project}`) : null,
          requiringBodyId: p.requiringBody ? id(`requiring_body:${p.requiringBody}`) : null,
        })),
      );

      for (const u of USERS) {
        const userId = id(`user:${u.email}`);
        await tx
          .insert(s.users)
          .values({ id: userId, fullName: u.fullName, email: u.email, passwordHash: hashes.get(u.email)! });
        await tx.insert(s.postAssignments).values(
          u.posts.map((postKey) => ({
            id: id(`assignment:${u.email}:${postKey}`),
            postId: id(`post:${postKey}`),
            userId,
            // Fixed far in the past so logins work whether or not DEMO_NOW is set.
            validFrom: new Date('2024-01-01T00:00:00+05:30'),
          })),
        );
      }

      summary = await seedV1(tx, { now, seed, id, packs, projects: seeded });
    });

    await pool.query(`SELECT set_config('app.now', $1, false)`, [now.toISOString()]);
    await pool.query(REFRESH_SQL);

    console.log(
      `seeded: ${STATES.length} states, ${DISTRICTS.length} districts, ${VILLAGES.length} villages, ` +
        `${packs.size} rule packs, ${PROJECTS.length} projects, ${POSTS.length} posts, ${USERS.length} users`,
    );
    console.log(`demo password for every account: ${DEMO_PASSWORD}`);
    console.log('seed v1:', JSON.stringify(summary, null, 2));
  } finally {
    await pool.end();
  }
}
