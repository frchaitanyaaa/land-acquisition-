import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { projects, stageInstances } from '../src/schema';
import { runScoped } from '../src/scope';
import { PROJECTS } from '../src/scripts/seed/fixtures';
import { asAppUser, asWorker, id, NOW, scope } from './helpers';

// §35 Phase 0 gate: "a DISTRICT-scoped user cannot read another district's project via RLS",
// plus §32.4: direct SQL through app_user returns 0 rows outside scope.

const { db } = asAppUser();

const PSX = 'MH-PSX-2026-001'; // Pune + Satara
const NGP = 'MH-NGP-2026-002'; // Nagpur
const BGM = 'KA-BGM-2026-003'; // Belagavi, Karnataka

// Expected visibility is derived from the seed fixtures (the input), not hard-coded, so growing the
// seed does not silently break this test. Sorted in JS on both sides — DB collation may order
// hyphenated codes differently.
const sorted = (codes: string[]) => [...codes].sort();
const seeded = (keep: (p: (typeof PROJECTS)[number]) => boolean) => sorted(PROJECTS.filter(keep).map((p) => p.code));
const inDistrict = (d: string) => seeded((p) => p.districts.includes(d));
const inState = (s: string) => seeded((p) => p.stateCode === s);
const ofBody = (b: string) => seeded((p) => p.requiringBody === b);
const ALL = seeded(() => true);

const visibleCodes = (s: Parameters<typeof scope>[0]) =>
  runScoped(db, scope(s), NOW, async (tx) =>
    sorted((await tx.select({ code: projects.code }).from(projects)).map((r) => r.code)),
  );

describe('seed fixtures cover every RLS branch', () => {
  // Guards against a fixture change that would make the derived expectations trivially pass.
  it('has projects in and out of each scope used below', () => {
    expect(inDistrict('SYN-MH-PUNE')).toContain(PSX);
    expect(inDistrict('SYN-MH-PUNE')).not.toContain(NGP);
    expect(inDistrict('SYN-MH-SATARA')).toContain(PSX);
    expect(inState('27')).toEqual(expect.arrayContaining([NGP, PSX]));
    expect(inState('27')).not.toContain(BGM);
    expect(inState('29')).toContain(BGM);
    expect(ofBody('NHAI')).toEqual(expect.arrayContaining([BGM, PSX]));
    expect(ofBody('NHAI').length).toBeLessThan(ALL.length);
  });
});

describe('project visibility (RLS, forced)', () => {
  it('a Pune district post cannot read the Nagpur project', async () => {
    const pune = { level: 'DISTRICT', districtCode: 'SYN-MH-PUNE' } as const;
    await runScoped(db, scope(pune), NOW, async (tx) => {
      const rows = await tx.select().from(projects).where(eq(projects.code, NGP));
      expect(rows).toEqual([]);
    });
    expect(await visibleCodes(pune)).toEqual(inDistrict('SYN-MH-PUNE'));
  });

  it('a multi-district project is visible from each of its districts', async () => {
    expect(await visibleCodes({ level: 'DISTRICT', districtCode: 'SYN-MH-SATARA' })).toEqual(inDistrict('SYN-MH-SATARA'));
    expect(await visibleCodes({ level: 'DISTRICT', districtCode: 'SYN-MH-PUNE' })).toContain(PSX);
  });

  it('a state post sees its own state only', async () => {
    expect(await visibleCodes({ level: 'STATE', stateCode: '27' })).toEqual(inState('27'));
    expect(await visibleCodes({ level: 'STATE', stateCode: '29' })).toEqual(inState('29'));
  });

  it('a national post sees everything', async () => {
    expect(await visibleCodes({ level: 'NATIONAL' })).toEqual(ALL);
  });

  it('a project post sees only its project; a requiring body sees its own projects', async () => {
    expect(await visibleCodes({ level: 'PROJECT', projectIds: [id(`project:${PSX}`)] })).toEqual([PSX]);
    expect(await visibleCodes({ level: 'PROJECT', requiringBodyId: id('requiring_body:NHAI') })).toEqual(ofBody('NHAI'));
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
    expect(await visibleProjects('SYN-MH-PUNE')).toEqual(inDistrict('SYN-MH-PUNE'));
    expect(await visibleProjects('SYN-KA-BELAGAVI')).toEqual(inDistrict('SYN-KA-BELAGAVI'));
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
    expect(rows).toHaveLength(ALL.length);
  });
});
