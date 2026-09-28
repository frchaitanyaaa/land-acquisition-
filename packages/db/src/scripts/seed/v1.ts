import { clockStatus, findClock, startClock, type Pack } from '@bhoomisetu/rules';
import type { LandClass } from '@bhoomisetu/shared';
import { sql } from 'drizzle-orm';
import type { Tx } from '../../client';
import { encryptPii, maskBankRef, maskPhone } from '../../pii';
import * as s from '../../schema';
import type { ProjectFixture } from './fixtures';
import { PROJECTS, VILLAGES } from './fixtures';
import type { SeedStage } from './history';
import { GIVEN_FEMALE, GIVEN_MALE, SURNAMES_MH, SURNAMES_OTHER } from './names';
import { mulberry32, seedOf, type Rng } from './rng';

// Seed v1 (§33): village geometry, synthetic parcels (Voronoi, §33.3), people and interests
// (§33.4), corridor intersection + constraint screening through the same SQL the API calls, consent
// registers, and a full money scenario for the project past its award (§33.5). Deterministic.

const DAY_MS = 86_400_000;

export interface SeedCtx {
  now: Date;
  seed: string;
  id: (name: string) => string;
  packs: Map<string, Pack>;
  projects: Array<{ fixture: ProjectFixture; projectId: string; stages: SeedStage[] }>;
}

async function q<T>(tx: Tx, query: ReturnType<typeof sql>): Promise<T[]> {
  return ((await tx.execute(query)) as unknown as { rows: T[] }).rows;
}

async function insertChunks<T>(rows: T[], size: number, fn: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

const geo = (gj: string) => sql`ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326))` as unknown as string;

/** Synthetic per-m² rates (paise) by land class — seed parameters, entered "as if by the Collector". */
const RATE_PAISE_PER_SQM: Record<LandClass, bigint> = {
  IRRIGATED_MULTICROP: 95_000n,
  AGRICULTURAL: 62_000n,
  UNIRRIGATED: 38_000n,
  NON_AGRI_COMMERCIAL: 260_000n,
  RESIDENTIAL: 310_000n,
  GOVT_WASTE: 15_000n,
  FOREST: 20_000n,
};

const LAND_CLASS_WEIGHTS: Array<[LandClass, number]> = [
  ['AGRICULTURAL', 55],
  ['UNIRRIGATED', 25],
  ['IRRIGATED_MULTICROP', 5],
  ['RESIDENTIAL', 6],
  ['NON_AGRI_COMMERCIAL', 3],
  ['GOVT_WASTE', 6],
];

function weighted<T>(rng: Rng, xs: Array<[T, number]>): T {
  const total = xs.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * total;
  for (const [x, w] of xs) if ((r -= w) < 0) return x;
  return xs[xs.length - 1]![0];
}

export async function seedV1(tx: Tx, ctx: SeedCtx) {
  const { now, id } = ctx;
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);
  const post = (key: string) => id(`post:${key}`);
  const summary: Record<string, unknown> = {};

  // ---------------------------------------------------------------- 1. geometry
  for (const v of VILLAGES) {
    const [a, b, c, d] = v.bounds;
    await tx.execute(
      sql`UPDATE villages SET boundary = ST_Multi(ST_MakeEnvelope(${a}, ${b}, ${c}, ${d}, 4326)) WHERE code = ${v.code}`,
    );
  }
  for (const { fixture: p, projectId } of ctx.projects) {
    if (p.site.kind === 'LINE') {
      const gj = JSON.stringify({ type: 'LineString', coordinates: p.site.coordinates });
      await tx.execute(
        sql`UPDATE projects SET alignment = ST_SetSRID(ST_GeomFromGeoJSON(${gj}), 4326) WHERE id = ${projectId}`,
      );
      await tx.execute(sql`UPDATE projects SET footprint = corridor(alignment, row_width_m) WHERE id = ${projectId}`);
    } else {
      const [a, b, c, d] = p.site.bounds;
      await tx.execute(
        sql`UPDATE projects SET footprint = ST_Multi(ST_MakeEnvelope(${a}, ${b}, ${c}, ${d}, 4326)) WHERE id = ${projectId}`,
      );
    }
    await tx.execute(sql`UPDATE projects SET total_area_proposed_sqm = area_sqm(footprint) WHERE id = ${projectId}`);
  }

  // Constraint layers — SYNTHETIC polygons placed to trigger flags (§33.2 fallback, labelled).
  const envelope = (b: [number, number, number, number]) =>
    sql`ST_Multi(ST_MakeEnvelope(${b[0]}, ${b[1]}, ${b[2]}, ${b[3]}, 4326))` as unknown as string;
  const layers: Array<{
    layerType: (typeof s.constraintLayers.$inferInsert)['layerType'];
    name: string;
    b: [number, number, number, number];
  }> = [
    { layerType: 'IRRIGATED_MULTICROP', name: 'Kapurhol canal command (synthetic)', b: [73.868, 18.285, 73.884, 18.3] },
    {
      layerType: 'SCHEDULED_AREA',
      name: 'Fifth Schedule area — Shirwal fringe (synthetic)',
      b: [73.955, 18.14, 73.99, 18.158],
    },
    { layerType: 'SCHEDULED_AREA', name: 'Fifth Schedule area — Kurkheda (synthetic)', b: [80.2, 20.6, 80.25, 20.64] },
    { layerType: 'WATER_BODY', name: 'Sanand village tank (synthetic)', b: [72.37, 22.985, 72.38, 22.992] },
    { layerType: 'ECO_SENSITIVE', name: 'Mulshi ESZ buffer (synthetic)', b: [73.7, 18.59, 73.72, 18.61] },
    {
      layerType: 'PROTECTED_FOREST',
      name: 'Sarole reserved forest patch (synthetic)',
      b: [73.912, 18.22, 73.93, 18.235],
    },
  ];
  await tx
    .insert(s.constraintLayers)
    .values(
      layers.map((l, i) => ({
        id: id(`constraint:${i}`),
        layerType: l.layerType,
        name: l.name,
        geom: envelope(l.b),
        source: 'synthetic',
        dataSource: 'SYNTHETIC_DEMO' as const,
      })),
    );

  // ---------------------------------------------------------------- 2. parcels (§33.3)
  const rng = mulberry32(seedOf(`${ctx.seed}:v1`));
  const parcelRows: Array<typeof s.landParcels.$inferInsert> = [];
  let reservedParcel: string | null = null;
  for (const [vi, v] of VILLAGES.entries()) {
    const cells = await q<{ gj: string; area: string; near: boolean; cx: number; cy: number }>(
      tx,
      sql`WITH v AS (SELECT boundary FROM villages WHERE code = ${v.code}),
            fp AS (SELECT ST_Union(p.footprint) AS g FROM projects p, v WHERE p.footprint IS NOT NULL AND ST_Intersects(p.footprint, v.boundary)),
            nearzone AS (SELECT CASE WHEN fp.g IS NULL THEN v.boundary
                                     ELSE ST_Intersection(v.boundary, ST_Buffer(fp.g::geography, 400)::geometry) END AS g FROM v, fp),
            pts AS (
              SELECT (ST_Dump(ST_GeneratePoints(nearzone.g, ${v.parcelsNear}, ${1000 + vi}))).geom AS pt FROM nearzone
              UNION ALL
              SELECT (ST_Dump(ST_GeneratePoints(v.boundary, ${v.parcelsFar}, ${2000 + vi}))).geom FROM v),
            cells AS (SELECT (ST_Dump(ST_VoronoiPolygons(ST_Collect(pt)))).geom AS cell FROM pts),
            clipped AS (SELECT ST_Multi(ST_CollectionExtract(ST_Intersection(cells.cell, v.boundary), 3)) AS g FROM cells, v)
          SELECT ST_AsGeoJSON(ST_ReducePrecision(g, 0.0000001), 7) AS gj, area_sqm(g) AS area,
                 EXISTS (SELECT 1 FROM fp WHERE fp.g IS NOT NULL AND ST_DWithin(g::geography, fp.g::geography, 300)) AS near,
                 ST_X(ST_PointOnSurface(g)) AS cx, ST_Y(ST_PointOnSurface(g)) AS cy
          FROM clipped WHERE NOT ST_IsEmpty(g) AND ST_Area(g::geography) > 200
          ORDER BY ST_Y(ST_PointOnSurface(g)) DESC, ST_X(ST_PointOnSurface(g))`,
    );
    let survey = 100 + vi * 7;
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]!;
      // ~20% of survey numbers are split into sub-divisions (214/1, 214/2 …).
      const split = i > 0 && rng.chance(0.2) && !parcelRows[parcelRows.length - 1]?.subDivision?.startsWith('3');
      let subDivision: string | null = null;
      if (split) {
        const prev = parcelRows[parcelRows.length - 1]!;
        prev.subDivision ??= '1';
        subDivision = String(Number(prev.subDivision) + 1);
      } else survey++;
      const area = Number(c.area);
      let landClass = weighted(rng, LAND_CLASS_WEIGHTS);
      const inCanal = v.code === 'SYN-MH-KAPURHOL' && c.cx > 73.868 && c.cx < 73.884 && c.cy > 18.285 && c.cy < 18.3;
      if (inCanal) landClass = 'IRRIGATED_MULTICROP';
      const fieldDrawn = c.near && rng.chance(0.3);
      const noise = 1 + (rng.next() * 2 - 1) * 0.08; // ±8%
      const parcelId = id(`parcel:${v.code}:${i}`);
      parcelRows.push({
        id: parcelId,
        villageCode: v.code,
        surveyNumber: String(survey),
        subDivision,
        geom: geo(c.gj),
        recordedAreaSqm: (Math.round(area * noise * 100) / 100).toFixed(2),
        boundarySource: fieldDrawn ? 'FIELD_DRAWN' : 'CADASTRAL_IMPORT',
        landClass,
        isIrrigatedMulticrop: landClass === 'IRRIGATED_MULTICROP',
        dataSource: 'SYNTHETIC_DEMO',
      });
      // Demo beat 4: one unsurveyed Khed Shivapur parcel near the corridor is reserved for walk-and-mark.
      if (!reservedParcel && v.code === 'SYN-MH-KHED-SHIVAPUR' && c.near && i > 10) {
        reservedParcel = parcelId;
        parcelRows[parcelRows.length - 1]!.boundarySource = 'SURVEY_REFERENCE_ONLY';
      }
    }
  }
  await insertChunks(parcelRows, 200, (chunk) => tx.insert(s.landParcels).values(chunk));
  summary.parcels = parcelRows.length;

  // ---------------------------------------------------------------- 3. people & interests (§33.4)
  const villageState = new Map(VILLAGES.map((v) => [v.code, v.code.startsWith('SYN-MH') ? 'MH' : 'OTHER']));
  const persons: Array<typeof s.persons.$inferInsert> = [];
  const interests: Array<typeof s.parcelInterests.$inferInsert> = [];
  for (const [pi, parcel] of parcelRows.entries()) {
    const owners = weighted(rng, [
      [1, 45],
      [2, 35],
      [3, 15],
      [4, 5],
    ] as Array<[number, number]>);
    const surname = rng.pick(villageState.get(parcel.villageCode) === 'MH' ? SURNAMES_MH : SURNAMES_OTHER);
    const tribal = parcel.villageCode === 'SYN-MH-KURKHEDA';
    const mk = (role: string): string => {
      const female = rng.chance(0.3);
      const personId = id(`person:${pi}:${role}`);
      const phone = `98${String(rng.int(0, 99_999_999)).padStart(8, '0')}`;
      const bank = String(rng.int(10_000_000, 99_999_999)) + String(rng.int(1000, 9999));
      const cat = tribal
        ? weighted(rng, [
            ['ST', 65],
            ['SC', 10],
            ['OBC', 15],
            ['GENERAL', 10],
          ] as Array<['ST' | 'SC' | 'OBC' | 'GENERAL', number]>)
        : weighted(rng, [
            ['GENERAL', 45],
            ['OBC', 35],
            ['SC', 12],
            ['ST', 8],
          ] as Array<['ST' | 'SC' | 'OBC' | 'GENERAL', number]>);
      persons.push({
        id: personId,
        fullName: `${rng.pick(female ? GIVEN_FEMALE : GIVEN_MALE)} ${role === 'tenant' || role === 'labourer' ? rng.pick(SURNAMES_MH) : surname}`,
        guardianName: `${rng.pick(GIVEN_MALE)} ${surname}`,
        gender: female ? 'F' : 'M',
        socialCategory: cat,
        villageCode: parcel.villageCode,
        phoneMasked: maskPhone(phone),
        phoneEnc: encryptPii(phone, rng.bytes(12)),
        bankRefMasked: maskBankRef(bank),
        bankRefEnc: encryptPii(bank, rng.bytes(12)),
        dataSource: 'SYNTHETIC_DEMO',
      });
      return personId;
    };
    const share = (1 / owners).toFixed(6);
    for (let o = 0; o < owners; o++) {
      interests.push({
        id: id(`interest:${pi}:o${o}`),
        parcelId: parcel.id!,
        personId: mk(`o${o}`),
        interestType: 'OWNER',
        shareFraction: share,
        verificationStatus: 'verified',
      });
    }
    if (rng.chance(0.15)) {
      interests.push({
        id: id(`interest:${pi}:t`),
        parcelId: parcel.id!,
        personId: mk('tenant'),
        interestType: rng.chance(0.5) ? 'TENANT' : 'SHARECROPPER',
        verificationStatus: 'verified',
      });
    }
    if (rng.chance(0.1)) {
      interests.push({
        id: id(`interest:${pi}:l`),
        parcelId: parcel.id!,
        personId: mk('labourer'),
        interestType: 'LABOURER',
        verificationStatus: 'pending',
      });
    }
  }
  await insertChunks(persons, 300, (chunk) => tx.insert(s.persons).values(chunk));
  await insertChunks(interests, 500, (chunk) => tx.insert(s.parcelInterests).values(chunk));
  summary.persons = persons.length;

  // ---------------------------------------------------------------- 4. per project: GIS pipeline
  for (const { fixture: p, projectId, stages } of ctx.projects) {
    const pack = ctx.packs.get(`${p.pack.code}@${p.pack.version}`)!;
    const approvedAt = (codes: string[]) =>
      stages.find((st) => codes.includes(st.stageCode) && st.status === 'APPROVED')?.completedAt ?? null;
    const notifiedAt = approvedAt(['S05_NOTIFICATION', 'NH_3A_INTENT']);
    const declaredAt = approvedAt(['S07_DECLARATION', 'NH_3D_DECLARATION']);
    const awardedAt = approvedAt(['S08_AWARD', 'NH_3G_AMOUNT']);

    await tx.execute(sql`SELECT intersect_project_parcels(${projectId})`);
    await tx.execute(sql`SELECT create_family_stubs(${projectId})`);
    await tx.execute(sql`SELECT screen_project_constraints(${projectId})`);

    const status = awardedAt
      ? 'AWARDED'
      : declaredAt
        ? 'CLEARED_FOR_AWARD_RNR'
        : notifiedAt
          ? 'CONSENT_ACQUIRED_NOTIFIED'
          : 'VERIFIED';
    await tx.execute(sql`UPDATE project_parcels SET status = ${status}::parcel_status WHERE project_id = ${projectId}`);
    if (reservedParcel) {
      await tx.execute(
        sql`UPDATE project_parcels SET status = 'VERIFICATION_PENDING' WHERE project_id = ${projectId} AND parcel_id = ${reservedParcel}`,
      );
    }
    if (notifiedAt) {
      await tx.execute(sql`UPDATE land_parcels SET transfer_frozen_at = ${notifiedAt}
                           WHERE id IN (SELECT parcel_id FROM project_parcels WHERE project_id = ${projectId})`);
    }

    // Family attributes (§33.4): plausible vulnerability rates; displacement where most of a holding goes.
    const fams = await q<{ id: string; max_pct: string | null; affected_type: string }>(
      tx,
      sql`SELECT af.id, af.affected_type,
                 (SELECT max(pp.affected_pct) FROM parcel_interests pi JOIN project_parcels pp ON pp.parcel_id = pi.parcel_id AND pp.project_id = af.project_id
                  WHERE pi.person_id = af.head_person_id) AS max_pct
          FROM affected_families af WHERE af.project_id = ${projectId} ORDER BY af.id`,
    );
    const frng = mulberry32(seedOf(`${ctx.seed}:fam:${p.code}`));
    for (const f of fams) {
      const displaced = f.affected_type === 'LAND_LOSER' && Number(f.max_pct ?? 0) > 60 && frng.chance(0.6);
      await tx
        .update(s.affectedFamilies)
        .set({
          isDisplaced: displaced,
          familySize: frng.int(2, 8),
          isFemaleHeaded: frng.chance(0.15),
          isDestitute: frng.chance(0.05),
          hasDisability: frng.chance(0.04),
          relocatedOutsideDistrict: displaced && frng.chance(0.05),
        })
        .where(sql`id = ${f.id}`);
    }
    summary[`families:${p.code}`] = fams.length;

    // Clocks started outside the workflow (§33.6 breach hooks).
    for (const x of p.extraClocks ?? []) {
      const at = daysAgo(x.startedDaysAgo);
      const started = startClock(pack, x.clock, at)!;
      const clock = findClock(pack, x.clock);
      await tx.insert(s.statutoryDeadlines).values({
        id: id(`deadline:${p.code}:${x.clock}:extra`),
        projectId,
        clockCode: x.clock,
        section: clock.section,
        subjectType: clock.subject,
        subjectId: x.subjectStage ? id(`stage:${p.code}:${x.subjectStage}:1`) : projectId,
        rulePackCode: pack.code,
        rulePackVersion: pack.version,
        startEvent: clock.startsOn,
        startedAt: at,
        dueAt: started.dueAt,
        consequence: clock.consequence,
        status: clockStatus(clock, started.dueAt, now, pack.thresholds.deadlineDueSoonDays),
        breachedAt: started.dueAt < now ? started.dueAt : null,
        conditionInputs: {},
      });
    }

    if (p.consent) await seedConsent(tx, ctx, p, projectId, pack);
    if (p.money && awardedAt)
      Object.assign(summary, await seedMoney(tx, ctx, p, projectId, pack, awardedAt, notifiedAt ?? awardedAt));
  }

  await seedLegalCases(tx, ctx);
  summary.reservedParcel = reservedParcel;
  return summary;
}

// ------------------------------------------------------------------ consent (§18.1)

async function seedConsent(tx: Tx, ctx: SeedCtx, p: ProjectFixture, projectId: string, _pack: Pack) {
  const { id, now } = ctx;
  const c = p.consent!;
  const registerId = id(`consent:${p.code}`);
  await tx.insert(s.consentRegisters).values({
    id: registerId,
    projectId,
    consentType: c.type,
    status: 'certified',
    displayFrom: new Date(now.getTime() - 50 * DAY_MS).toISOString().slice(0, 10),
    displayTo: new Date(now.getTime() - 35 * DAY_MS).toISOString().slice(0, 10),
    certifiedAt: new Date(now.getTime() - 30 * DAY_MS),
    certifiedByPostId: null,
  });
  const people = await q<{ person_id: string }>(
    tx,
    c.type === 'GRAM_SABHA_S41'
      ? sql`SELECT head_person_id AS person_id FROM affected_families WHERE project_id = ${projectId} ORDER BY head_person_id`
      : sql`SELECT DISTINCT pi.person_id FROM project_parcels pp JOIN parcel_interests pi ON pi.parcel_id = pp.parcel_id
            WHERE pp.project_id = ${projectId} AND pi.interest_type = 'OWNER' ORDER BY pi.person_id`,
  );
  const entries = people.map((r, i) => ({
    id: id(`consent-entry:${p.code}:${i}`),
    registerId,
    personId: r.person_id,
    eligibilityBasis: c.type === 'GRAM_SABHA_S41' ? 'Gram Sabha member (s.41)' : 'Recorded owner (7/12)',
    status: 'eligible' as const,
  }));
  await insertChunks(entries, 500, (chunk) => tx.insert(s.consentRegisterEntries).values(chunk));
  const nConsent = Math.round(entries.length * c.consentedShare);
  const nRefuse = Math.round(entries.length * c.refusedShare);
  const collector = p.code === 'MH-NGP-2026-002' ? id('post:LAO_NAGPUR') : id('post:SUPER');
  const observer = p.code === 'MH-NGP-2026-002' ? id('post:DLSA_NAGPUR') : null;
  const records = entries.slice(0, nConsent + nRefuse).map((e, i) => ({
    id: id(`consent-record:${p.code}:${i}`),
    registerEntryId: e.id,
    decision: (i < nConsent ? 'CONSENT' : 'REFUSE') as 'CONSENT' | 'REFUSE',
    collectedByPostId: collector,
    observerPostId: observer,
    observerCertified: !!observer,
    collectedAt: new Date(now.getTime() - (20 - (i % 15)) * DAY_MS),
    identityCheckRef: `DEMO-${String(i).padStart(4, '0')}`,
    identityProvider: 'MOCK',
  }));
  await insertChunks(records, 500, (chunk) => tx.insert(s.consentRecords).values(chunk));
}

// ------------------------------------------------------------------ money (§33.5)

type MoneyState = 'PAID_ACK' | 'DISBURSED' | 'PART' | 'UNPAID' | 'DEPOSITED' | 'PROTEST';
const MONEY_STATES: Array<[MoneyState, number]> = [
  ['PAID_ACK', 60],
  ['DISBURSED', 15],
  ['PART', 10],
  ['UNPAID', 10],
  ['DEPOSITED', 3],
  ['PROTEST', 2],
];

async function seedMoney(
  tx: Tx,
  ctx: SeedCtx,
  p: ProjectFixture,
  projectId: string,
  pack: Pack,
  awardAt: Date,
  notifiedAt: Date,
) {
  const { id, now } = ctx;
  const rng = mulberry32(seedOf(`${ctx.seed}:money:${p.code}`));
  const coll = id('post:COLL_SATARA');
  const lao = id('post:LAO_SATARA');
  const head = (code: string) => pack.entitlementHeads.find((h) => h.code === code)!;
  const minTotal = (code: string) => BigInt(head(code).minPaise ?? '0') * BigInt(head(code).periods ?? 1);
  const solatiumPct = BigInt(pack.checks.find((c) => c.code === 'SOLATIUM_100')!.params.pct as number);
  const addlPct = BigInt(
    pack.checks.find((c) => c.code === 'ADDITIONAL_12PA_PRESENT')!.params.ratePctPerAnnum as number,
  );
  const addlDays = BigInt(Math.max(1, Math.round((awardAt.getTime() - notifiedAt.getTime()) / DAY_MS)));

  const landAward = id(`award:${p.code}:LAND`);
  const rnrAward = id(`award:${p.code}:RNR`);
  await tx.insert(s.awards).values([
    {
      id: landAward,
      projectId,
      awardType: 'LAND',
      awardNo: `${p.code}/LAND/1`,
      pronouncedAt: awardAt,
      collectorPostId: coll,
      laoPostId: lao,
      status: 'signed',
    },
    {
      id: rnrAward,
      projectId,
      awardType: 'RNR',
      awardNo: `${p.code}/RNR/1`,
      pronouncedAt: awardAt,
      collectorPostId: coll,
      laoPostId: lao,
      status: 'signed',
    },
  ]);

  const fams = await q<{
    id: string;
    head_person_id: string;
    affected_type: string;
    is_displaced: boolean;
    is_sc_st: boolean;
    land_paise: string;
  }>(
    tx,
    sql`SELECT af.id, af.head_person_id, af.affected_type, af.is_displaced, af.is_sc_st,
               coalesce((SELECT sum(round(pp.affected_area_sqm * coalesce(pi.share_fraction, 1) *
                          CASE lp.land_class
                            WHEN 'IRRIGATED_MULTICROP' THEN ${RATE_PAISE_PER_SQM.IRRIGATED_MULTICROP}::bigint WHEN 'AGRICULTURAL' THEN ${RATE_PAISE_PER_SQM.AGRICULTURAL}::bigint
                            WHEN 'UNIRRIGATED' THEN ${RATE_PAISE_PER_SQM.UNIRRIGATED}::bigint WHEN 'NON_AGRI_COMMERCIAL' THEN ${RATE_PAISE_PER_SQM.NON_AGRI_COMMERCIAL}::bigint
                            WHEN 'RESIDENTIAL' THEN ${RATE_PAISE_PER_SQM.RESIDENTIAL}::bigint WHEN 'GOVT_WASTE' THEN ${RATE_PAISE_PER_SQM.GOVT_WASTE}::bigint
                            ELSE ${RATE_PAISE_PER_SQM.FOREST}::bigint END))
                         FROM parcel_interests pi JOIN project_parcels pp ON pp.parcel_id = pi.parcel_id AND pp.project_id = af.project_id
                         JOIN land_parcels lp ON lp.id = pi.parcel_id
                         WHERE pi.person_id = af.head_person_id AND pi.interest_type = 'OWNER'), 0)::bigint::text AS land_paise
        FROM affected_families af WHERE af.project_id = ${projectId} ORDER BY af.id`,
  );

  const ents: Array<typeof s.entitlements.$inferInsert> = [];
  const disb: Array<typeof s.disbursements.$inferInsert> = [];
  const acks: Array<typeof s.acknowledgements.$inferInsert> = [];
  const deadlines: Array<typeof s.statutoryDeadlines.$inferInsert> = [];
  const annuities: Array<typeof s.annuitySchedules.$inferInsert> = [];
  const familyState = new Map<string, MoneyState>();
  let demoFamily: string | null = null;
  let heldFamily: string | null = null;
  let gapDisbursed = 0n;
  let gapAck = 0n;

  for (const [fi, f] of fams.entries()) {
    const state = weighted(rng, MONEY_STATES);
    familyState.set(f.id, state);
    const heads: Array<{ code: string; amount: bigint }> = [];
    const land = BigInt(f.land_paise);
    if (land > 0n) {
      const assets = (land * BigInt(rng.int(5, 25))) / 100n;
      heads.push({ code: 'LAND_COMPENSATION', amount: land });
      heads.push({ code: 'ASSETS', amount: assets });
      heads.push({ code: 'SOLATIUM', amount: ((land + assets) * solatiumPct) / 100n });
      heads.push({ code: 'ADDITIONAL_12PA', amount: (land * addlPct * addlDays) / (100n * 365n) });
    }
    if (f.affected_type !== 'LAND_LOSER') heads.push({ code: 'SUBSISTENCE', amount: minTotal('SUBSISTENCE') });
    let annuity = false;
    if (f.is_displaced) {
      annuity = rng.chance(0.4);
      heads.push(
        annuity
          ? { code: 'ANNUITY', amount: minTotal('ANNUITY') }
          : { code: 'ONE_TIME_5L', amount: minTotal('ONE_TIME_5L') },
      );
      heads.push({ code: 'SUBSISTENCE', amount: minTotal('SUBSISTENCE') });
      heads.push({ code: 'TRANSPORT', amount: minTotal('TRANSPORT') });
      heads.push({ code: 'RESETTLEMENT_ALLOWANCE', amount: minTotal('RESETTLEMENT_ALLOWANCE') });
      if (f.is_sc_st && rng.chance(0.3))
        heads.push({ code: 'SUBSISTENCE_SCST_EXTRA', amount: minTotal('SUBSISTENCE_SCST_EXTRA') });
    }

    for (const [hi, h] of heads.entries()) {
      const def = head(h.code);
      const entId = id(`ent:${p.code}:${fi}:${hi}`);
      const clockCode =
        def.kind === 'LAND' ? 'COMPENSATION_PAYMENT' : def.kind === 'MONETARY_RNR' ? 'MONETARY_RNR' : null;
      const started = clockCode ? startClock(pack, clockCode, awardAt)! : null;
      const lump = h.code !== 'ANNUITY';
      let status: (typeof s.entitlements.$inferInsert)['status'] = 'SANCTIONED';
      let paidOn: Date | null = null;
      const payAt = new Date(awardAt.getTime() + rng.int(5, 55) * DAY_MS);
      const pay = (
        instrument: 'DBT' | 'DEPOSIT_WITH_AUTHORITY',
        acceptance: 'ABSOLUTE' | 'UNDER_PROTEST' | null = 'ABSOLUTE',
      ) => {
        const dId = id(`disb:${entId}`);
        disb.push({
          id: dId,
          entitlementId: entId,
          amountPaise: h.amount,
          instrument,
          initiatedAt: payAt,
          paidOn: payAt.toISOString().slice(0, 10),
          paymentStatus: 'SUCCESS',
          adapterRef: `MOCK-${dId.slice(0, 8)}`,
          adapterProvider: 'MOCK',
          isFirstInstalment: true,
          acceptanceType: instrument === 'DBT' ? acceptance : null,
        });
        paidOn = payAt;
        return dId;
      };
      if (lump) {
        const payThis =
          state === 'PAID_ACK' ||
          state === 'DISBURSED' ||
          state === 'DEPOSITED' ||
          state === 'PROTEST' ||
          (state === 'PART' && def.kind === 'LAND' && h.code === 'LAND_COMPENSATION');
        if (payThis) {
          if (state === 'DEPOSITED') {
            pay('DEPOSIT_WITH_AUTHORITY');
            status = 'DEPOSITED_WITH_AUTHORITY';
          } else if (state === 'PROTEST') {
            pay('DBT', 'UNDER_PROTEST');
            status = 'UNDER_PROTEST';
            gapDisbursed += h.amount;
          } else {
            const dId = pay('DBT');
            gapDisbursed += h.amount;
            if (state === 'PAID_ACK' || state === 'PART') {
              const officer = rng.chance(0.25);
              acks.push({
                id: id(`ack:${dId}`),
                disbursementId: dId,
                method: officer ? 'OFFICER_ATTESTED' : 'OTP',
                otpRef: officer ? null : `MOCK-OTP-${dId.slice(0, 6)}`,
                witnessPostId: officer ? lao : null,
                fallbackReason: officer ? 'Elderly beneficiary without a mobile phone' : null,
                confirmedAt: new Date(payAt.getTime() + rng.int(1, 9) * DAY_MS),
              });
              status = 'ACKNOWLEDGED';
              gapAck += h.amount;
            } else status = 'DISBURSED';
          }
        } else if (state === 'UNPAID' && !heldFamily && h.code === 'LAND_COMPENSATION') {
          // Demo beat 7: a payment on hold with a restricted reason (§11.4).
          heldFamily = f.id;
          disb.push({
            id: id(`disb:${entId}`),
            entitlementId: entId,
            amountPaise: h.amount,
            instrument: 'DBT',
            initiatedAt: payAt,
            paymentStatus: 'PENDING',
            adapterProvider: 'MOCK',
            holdReasonCode: 'DOCUMENT_PENDING',
            holdReason:
              'Legal-heir certificate for a deceased co-owner awaited from the Tehsildar; mutation entry disputed by a sibling (synthetic).',
          });
        }
      } else {
        // Annuity: 20 years × 12 monthly instalments; those already due are paid (§23).
        for (let m = 1; m <= Number(def.periods ?? 1); m++) {
          const due = new Date(awardAt.getTime() + m * 30 * DAY_MS);
          annuities.push({
            id: id(`annuity:${entId}:${m}`),
            entitlementId: entId,
            instalmentNo: m,
            dueOn: due.toISOString().slice(0, 10),
            amountPaise: BigInt(def.minPaise ?? '0'),
            status: due < now ? 'paid' : 'scheduled',
          });
        }
      }
      if (!demoFamily && state === 'DISBURSED') demoFamily = f.id;

      ents.push({
        id: entId,
        affectedFamilyId: f.id,
        awardId: def.kind === 'LAND' ? landAward : rnrAward,
        scheduleRef: def.schedule,
        headCode: h.code,
        amountAwardedPaise: h.amount,
        source: 'manual',
        dueBy: started?.dueAt ?? null,
        status,
      });
      if (clockCode && started && lump) {
        const clock = findClock(pack, clockCode);
        const satisfiedAt = paidOn as Date | null;
        deadlines.push({
          id: id(`deadline:${entId}`),
          projectId,
          clockCode,
          section: clock.section,
          subjectType: 'ENTITLEMENT',
          subjectId: entId,
          rulePackCode: pack.code,
          rulePackVersion: pack.version,
          startEvent: clock.startsOn,
          startedAt: awardAt,
          dueAt: started.dueAt,
          consequence: clock.consequence,
          status: clockStatus(clock, started.dueAt, now, pack.thresholds.deadlineDueSoonDays, satisfiedAt),
          satisfiedAt,
          conditionInputs: {},
        });
      }
    }
  }
  await insertChunks(ents, 500, (c) => tx.insert(s.entitlements).values(c));
  await insertChunks(disb, 500, (c) => tx.insert(s.disbursements).values(c));
  await insertChunks(acks, 500, (c) => tx.insert(s.acknowledgements).values(c));
  await insertChunks(deadlines, 500, (c) => tx.insert(s.statutoryDeadlines).values(c));
  await insertChunks(annuities, 1000, (c) => tx.insert(s.annuitySchedules).values(c));

  // Possession where every family on the parcel is settled (the gate would pass), for a share of parcels.
  const parcels = await q<{ id: string; parcel_id: string; settled: boolean }>(
    tx,
    sql`SELECT pp.id, pp.parcel_id,
               NOT EXISTS (SELECT 1 FROM parcel_interests pi JOIN affected_families af ON af.head_person_id = pi.person_id AND af.project_id = pp.project_id
                           JOIN entitlements e ON e.affected_family_id = af.id AND e.head_code IN ('LAND_COMPENSATION','ASSETS','SOLATIUM','ADDITIONAL_12PA')
                           WHERE pi.parcel_id = pp.parcel_id AND e.status NOT IN ('ACKNOWLEDGED','DEPOSITED_WITH_AUTHORITY','UNDER_PROTEST')) AS settled
        FROM project_parcels pp WHERE pp.project_id = ${projectId} ORDER BY pp.chainage_km NULLS LAST, pp.id`,
  );
  const target = Math.round(parcels.length * p.money!.possessionShare);
  const utilisation = findClock(pack, 'UTILISATION');
  let possessed = 0;
  let blockedParcel: string | null = null;
  for (const pp of parcels) {
    if (!pp.settled) {
      blockedParcel ??= pp.id;
      continue;
    }
    if (possessed >= target) continue;
    possessed++;
    const takenAt = new Date(now.getTime() - rng.int(8, 40) * DAY_MS);
    await tx.insert(s.possessionEvents).values({
      id: id(`possession:${pp.id}`),
      projectParcelId: pp.id,
      takenAt,
      takenByPostId: lao,
      witnesses: [{ name: 'Police Patil (synthetic)' }, { name: 'Sarpanch (synthetic)' }],
    });
    await tx.execute(sql`UPDATE project_parcels SET status = 'ACQUIRED_POSSESSED' WHERE id = ${pp.id}`);
    const u = startClock(pack, 'UTILISATION', takenAt)!;
    await tx.insert(s.statutoryDeadlines).values({
      id: id(`deadline:util:${pp.id}`),
      projectId,
      clockCode: 'UTILISATION',
      section: utilisation.section,
      subjectType: 'PROJECT_PARCEL',
      subjectId: pp.id,
      rulePackCode: pack.code,
      rulePackVersion: pack.version,
      startEvent: utilisation.startsOn,
      startedAt: takenAt,
      dueAt: u.dueAt,
      consequence: utilisation.consequence,
      status: 'SAFE',
      conditionInputs: {},
    });
  }

  // Resettlement site with partial amenity readiness (§19).
  const siteId = id(`site:${p.code}`);
  await tx
    .insert(s.resettlementSites)
    .values({ id: siteId, projectId, name: `${p.name} — Resettlement Colony A`, capacityFamilies: 120 });
  const amenities = [
    'ROADS_ALL_WEATHER_LINK',
    'DRAINAGE_SANITATION',
    'SAFE_DRINKING_WATER',
    'ELECTRIC_CONNECTIONS',
    'SCHOOL_RTE',
    'ANGANWADI',
    'PRIMARY_HEALTH_CENTRE',
    'FAIR_PRICE_SHOP',
    'PANCHAYAT_GHAR',
    'COMMUNITY_CENTRE_PER_100',
  ];
  await tx
    .insert(s.amenityMilestones)
    .values(
      amenities.map((a, i) => ({
        id: id(`amenity:${siteId}:${a}`),
        siteId,
        amenityCode: a,
        status: (i < 7 ? 'complete' : i < 9 ? 'in_progress' : 'planned') as 'complete' | 'in_progress' | 'planned',
        completedAt: i < 7 ? new Date(now.getTime() - (60 - i) * DAY_MS) : null,
      })),
    );
  await tx.execute(
    sql`UPDATE affected_families SET resettlement_site_id = ${siteId} WHERE project_id = ${projectId} AND is_displaced`,
  );

  return {
    [`money:${p.code}`]: {
      families: fams.length,
      entitlements: ents.length,
      disbursedPaise: gapDisbursed.toString(),
      acknowledgedPaise: gapAck.toString(),
      unconfirmedPaise: (gapDisbursed - gapAck).toString(),
      possessedParcels: possessed,
      demoFamily,
      heldFamily,
      possessionBlockedProjectParcel: blockedParcel,
    },
  };
}

// ------------------------------------------------------------------ legal cases (§22)

async function seedLegalCases(tx: Tx, ctx: SeedCtx) {
  const { id, now } = ctx;
  const rng = mulberry32(seedOf(`${ctx.seed}:legal`));
  const cases: Array<typeof s.legalCases.$inferInsert> = [];
  const pool = ctx.projects.filter((p) =>
    p.stages.some((st) => st.status === 'APPROVED' && st.stageCode !== 'S01_PROPOSAL'),
  );
  for (let i = 0; i < 40; i++) {
    const p = pool[i % pool.length]!;
    const type = weighted(rng, [
      ['S64_REFERENCE', 45],
      ['WRIT', 30],
      ['S74_APPEAL', 15],
      ['S73_REDETERMINATION', 10],
    ] as Array<['S64_REFERENCE' | 'WRIT' | 'S74_APPEAL' | 'S73_REDETERMINATION', number]>);
    const st = weighted(rng, [
      ['filed', 30],
      ['hearing', 40],
      ['decided', 15],
      ['appealed', 5],
      ['closed', 10],
    ] as Array<['filed' | 'hearing' | 'decided' | 'appealed' | 'closed', number]>);
    cases.push({
      id: id(`legal:${i}`),
      projectId: p.projectId,
      caseType: type,
      caseNo: `${type.replace('_', '-')}/${2025 + (i % 2)}/${100 + i}`,
      filedAt: new Date(now.getTime() - rng.int(30, 500) * DAY_MS),
      status: st,
      nextHearingAt: st === 'hearing' || st === 'filed' ? new Date(now.getTime() + rng.int(3, 90) * DAY_MS) : null,
      differentialLiabilityPaise: st === 'decided' ? BigInt(rng.int(2, 60)) * 100_000_00n : null,
    });
  }
  await tx.insert(s.legalCases).values(cases);
}
