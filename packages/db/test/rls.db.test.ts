import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projects, stageInstances } from '../src/schema';
import { runScoped } from '../src/scope';
import { asAppUser, asWorker, id, NOW, scope } from './helpers';

// §35 Phase 0 gate: "a DISTRICT-scoped user cannot read another district's project via RLS",
// plus §32.4: direct SQL through app_user returns 0 rows outside scope.

const { db } = asAppUser();

const PSX = 'MH-PSX-2026-001'; // Pune + Satara
const NGP = 'MH-NGP-2026-002'; // Nagpur
const BGM = 'KA-BGM-2026-003'; // Belagavi, Karnataka

const visibleCodes = (s: Parameters<typeof scope>[0]) =>
  runScoped(db, scope(s), NOW, async (tx) =>
    (await tx.select({ code: projects.code }).from(projects).orderBy(projects.code)).map((r) => r.code),
  );

describe('project visibility (RLS, forced)', () => {
  it('a Pune district post cannot read the Nagpur project', async () => {
    const pune = { level: 'DISTRICT', districtCode: 'SYN-MH-PUNE' } as const;
    await runScoped(db, scope(pune), NOW, async (tx) => {
      const rows = await tx.select().from(projects).where(eq(projects.code, NGP));
      expect(rows).toEqual([]);
    });
    expect(await visibleCodes(pune)).toEqual([PSX]);
  });

  it('a multi-district project is visible from each of its districts', async () => {
    expect(await visibleCodes({ level: 'DISTRICT', districtCode: 'SYN-MH-SATARA' })).toEqual([PSX]);
  });

  it('a state post sees its own state only', async () => {
    expect(await visibleCodes({ level: 'STATE', stateCode: '27' })).toEqual([NGP, PSX]);
    expect(await visibleCodes({ level: 'STATE', stateCode: '29' })).toEqual([BGM]);
  });

  it('a national post sees everything', async () => {
    expect(await visibleCodes({ level: 'NATIONAL' })).toEqual([BGM, NGP, PSX]);
  });

  it('a project post sees only its project; a requiring body sees its own projects', async () => {
    expect(await visibleCodes({ level: 'PROJECT', projectIds: [id(`project:${PSX}`)] })).toEqual([PSX]);
    expect(await visibleCodes({ level: 'PROJECT', requiringBodyId: id('requiring_body:NHAI') })).toEqual([BGM, PSX]);
  });

  it('no scope (public / forgotten withScope) sees nothing', async () => {
    expect(await visibleCodes({})).toEqual([]);
    const outside = await db.select({ code: projects.code }).from(projects);
    expect(outside).toEqual([]);
  });

  it('child tables inherit the project filter', async () => {
    const visibleProjects = (districtCode: string) =>
      runScoped(db, scope({ level: 'DISTRICT', districtCode }), NOW, async (tx) =>
        [
          ...new Set(
            (
              await tx
                .select({ code: projects.code })
                .from(stageInstances)
                .innerJoin(projects, eq(projects.id, stageInstances.projectId))
            ).map((r) => r.code),
          ),
        ].sort(),
      );
    const rawStageRows = (districtCode: string) =>
      runScoped(db, scope({ level: 'DISTRICT', districtCode }), NOW, async (tx) =>
        (await tx.select({ projectId: stageInstances.projectId }).from(stageInstances)).map((r) => r.projectId),
      );
    expect(await visibleProjects('SYN-MH-PUNE')).toEqual(['MH-PSX-2026-001']);
    expect(await visibleProjects('SYN-KA-BELAGAVI')).toEqual(['KA-BGM-2026-003']);
    // Every stage row the district sees belongs to a project it can see.
    const own = await runScoped(db, scope({ level: 'DISTRICT', districtCode: 'SYN-MH-PUNE' }), NOW, async (tx) =>
      (await tx.select({ id: projects.id }).from(projects)).map((r) => r.id),
    );
    const rows = await rawStageRows('SYN-MH-PUNE');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((id) => own.includes(id))).toBe(true);
  });

  it('cannot write a row into a project outside scope', async () => {
    const attempt = runScoped(db, scope({ level: 'DISTRICT', districtCode: 'SYN-MH-PUNE' }), NOW, (tx) =>
      tx.insert(stageInstances).values({ projectId: id(`project:${NGP}`), stageCode: 'S05_NOTIFICATION', attempt: 9 }),
    );
    await expect(attempt).rejects.toThrow();
  });

  it('request handlers can never DELETE (G14)', async () => {
    const attempt = runScoped(db, scope({ level: 'NATIONAL' }), NOW, (tx) =>
      tx.delete(stageInstances).where(eq(stageInstances.projectId, id(`project:${PSX}`))),
    );
    await expect(attempt).rejects.toThrow();
  });

  it('request handlers cannot read password hashes', async () => {
    await expect(db.execute(sql`SELECT password_hash FROM users LIMIT 1`)).rejects.toThrow();
  });

  it('the worker role bypasses RLS (jobs only)', async () => {
    const { db: worker } = asWorker();
    const rows = await worker.select({ code: projects.code }).from(projects);
    expect(rows).toHaveLength(3);
  });
});
