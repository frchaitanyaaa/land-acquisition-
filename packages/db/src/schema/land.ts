import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { id, lineString, multiPolygon, point, stamps, timestamptz } from './_columns';
import { villages } from './admin';
import {
  boundarySourceEnum,
  constraintLayerEnum,
  correctionStatusEnum,
  cprTypeEnum,
  dataSourceEnum,
  fieldSurveyStatusEnum,
  jirItemTypeEnum,
  landClassEnum,
  parcelFlagEnum,
  parcelStatusEnum,
  surveyTypeEnum,
  vertexCaptureMethodEnum,
} from './enums';
import { posts, users } from './org';
import { projects } from './projects';
import { documents } from './trust';

// Land & GIS (§10.3). A parcel is land, not part of a project: projects reach parcels through
// project_parcels, which is what makes overlap detection and partial acquisition possible.

/** Versioned (trg_versions_land_parcels → land_parcels_versions). geom_hash is set by trigger (G11). */
export const landParcels = pgTable(
  'land_parcels',
  {
    id: id(),
    villageCode: text()
      .notNull()
      .references(() => villages.code),
    surveyNumber: text().notNull(),
    subDivision: text(),
    geom: multiPolygon().notNull(),
    /** From RoR / cadastral. */
    recordedAreaSqm: numeric({ precision: 14, scale: 2 }),
    /** Computed from the walked polygon (trigger, when boundary_source = FIELD_DRAWN). */
    fieldAreaSqm: numeric({ precision: 14, scale: 2 }),
    areaDiffPct: numeric({ precision: 9, scale: 2 }).generatedAlwaysAs(
      sql`CASE WHEN recorded_area_sqm > 0 AND field_area_sqm IS NOT NULL
               THEN round((field_area_sqm - recorded_area_sqm) / recorded_area_sqm * 100, 2) END`,
    ),
    boundarySource: boundarySourceEnum().notNull(),
    landClass: landClassEnum().notNull(),
    isIrrigatedMulticrop: boolean().notNull().default(false),
    inScheduledArea: boolean().notNull().default(false),
    /** s.11 freeze. */
    transferFrozenAt: timestamptz(),
    /** geom_canonical_hash(geom), maintained by trg_parcel_geom. Never compute this in TS. */
    geomHash: text(),
    version: integer().notNull().default(1),
    dataSource: dataSourceEnum().notNull(),
    ...stamps,
  },
  (t) => [
    uniqueIndex('land_parcels_survey_uidx').on(t.villageCode, t.surveyNumber, sql`coalesce(${t.subDivision}, '')`),
    index().using('gist', t.geom),
  ],
);

export const projectParcels = pgTable(
  'project_parcels',
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id),
    parcelId: uuid()
      .notNull()
      .references(() => landParcels.id),
    affectedGeom: multiPolygon(),
    affectedAreaSqm: numeric({ precision: 14, scale: 2 }),
    affectedPct: numeric({ precision: 5, scale: 2 }),
    /** Linear projects. */
    chainageKm: numeric({ precision: 9, scale: 3 }),
    status: parcelStatusEnum().notNull().default('PROPOSED'),
    flags: parcelFlagEnum()
      .array()
      .notNull()
      .default(sql`'{}'`),
    severanceClaimed: boolean().notNull().default(false),
    ...stamps,
  },
  (t) => [unique().on(t.projectId, t.parcelId), index().on(t.parcelId)],
);

export const fieldSurveys = pgTable('field_surveys', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  parcelId: uuid().references(() => landParcels.id),
  surveyType: surveyTypeEnum().notNull(),
  surveyorUserId: uuid()
    .notNull()
    .references(() => users.id),
  surveyorPostId: uuid()
    .notNull()
    .references(() => posts.id),
  startedAt: timestamptz(),
  submittedAt: timestamptz(),
  deviceInfo: jsonb(),
  /** Walked track. */
  track: lineString(),
  /** s.12 */
  noticeServedOn: date(),
  noticeDocumentId: uuid().references(() => documents.id),
  status: fieldSurveyStatusEnum().notNull().default('draft'),
  verifiedByPostId: uuid().references(() => posts.id),
  verificationRemarks: text(),
  overrideReason: text(),
  /** Results of the §15.6 checks. */
  plausibility: jsonb(),
  ...stamps,
});

export const parcelVertices = pgTable(
  'parcel_vertices',
  {
    id: id(),
    surveyId: uuid()
      .notNull()
      .references(() => fieldSurveys.id),
    parcelId: uuid().references(() => landParcels.id),
    seq: integer().notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    accuracyM: numeric({ precision: 8, scale: 2 }),
    captureMethod: vertexCaptureMethodEnum().notNull(),
    samplesAveraged: integer(),
    photoDocumentId: uuid().references(() => documents.id),
    /** Device clock (claimed). */
    capturedAt: timestamptz().notNull(),
    /** Server clock (authoritative). */
    syncedAt: timestamptz().notNull(),
    ...stamps,
  },
  (t) => [unique().on(t.surveyId, t.seq)],
);

export const jirItems = pgTable('jir_items', {
  id: id(),
  surveyId: uuid()
    .notNull()
    .references(() => fieldSurveys.id),
  parcelId: uuid()
    .notNull()
    .references(() => landParcels.id),
  itemType: jirItemTypeEnum().notNull(),
  description: text(),
  quantity: numeric({ precision: 12, scale: 2 }),
  unit: text(),
  photoDocumentId: uuid().references(() => documents.id),
  point: point(),
  ...stamps,
});

export const boundaryPillars = pgTable(
  'boundary_pillars',
  {
    id: id(),
    parcelId: uuid()
      .notNull()
      .references(() => landParcels.id),
    pillarNo: integer().notNull(),
    point: point().notNull(),
    photoDocumentId: uuid().references(() => documents.id),
    ...stamps,
  },
  (t) => [unique().on(t.parcelId, t.pillarNo)],
);

/** Reference layers (forest, eco-sensitive, water, scheduled area, irrigated multi-crop). */
export const constraintLayers = pgTable(
  'constraint_layers',
  {
    id: id(),
    layerType: constraintLayerEnum().notNull(),
    name: text().notNull(),
    geom: multiPolygon().notNull(),
    source: text(),
    dataSource: dataSourceEnum().notNull(),
    ...stamps,
  },
  (t) => [index().using('gist', t.geom)],
);

export const spatialFlags = pgTable('spatial_flags', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  projectParcelId: uuid().references(() => projectParcels.id),
  layerType: constraintLayerEnum(),
  flagType: text().notNull(),
  overlapAreaSqm: numeric({ precision: 14, scale: 2 }),
  message: text().notNull(),
  raisedAt: timestamptz().notNull(),
  acknowledgedByPostId: uuid().references(() => posts.id),
  acknowledgedAt: timestamptz(),
  ...stamps,
});

export const commonPropertyResources = pgTable('common_property_resources', {
  id: id(),
  projectId: uuid()
    .notNull()
    .references(() => projects.id),
  villageCode: text()
    .notNull()
    .references(() => villages.code),
  cprType: cprTypeEnum().notNull(),
  name: text().notNull(),
  point: point(),
  affected: boolean().notNull().default(true),
  notes: text(),
  ...stamps,
});

/** Versioned, never silent (§15.4): requested → approved by a different post → new parcel version. */
export const parcelCorrections = pgTable('parcel_corrections', {
  id: id(),
  parcelId: uuid()
    .notNull()
    .references(() => landParcels.id),
  fromVersion: integer().notNull(),
  toVersion: integer(),
  reason: text().notNull(),
  requestedByPostId: uuid()
    .notNull()
    .references(() => posts.id),
  approvedByPostId: uuid().references(() => posts.id),
  status: correctionStatusEnum().notNull().default('requested'),
  decidedAt: timestamptz(),
  ...stamps,
});
