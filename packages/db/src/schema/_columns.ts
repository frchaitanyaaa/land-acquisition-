import { sql } from 'drizzle-orm';
import { bigint, customType, timestamp, uuid } from 'drizzle-orm/pg-core';

// Column helpers shared by every table. Tables are declared with camelCase keys; the client and
// drizzle-kit both run with `casing: 'snake_case'`, so `fieldAreaSqm` is `field_area_sqm` in SQL.

/** PostGIS geometry in EPSG:4326 (G10). Read back as hex EWKB; write with sql`ST_GeomFromGeoJSON(...)`. */
const geometryOf = (type: 'MultiPolygon' | 'LineString' | 'Point') =>
  customType<{ data: string; driverData: string }>({ dataType: () => `geometry(${type},4326)` });

export const multiPolygon = geometryOf('MultiPolygon');
export const lineString = geometryOf('LineString');
export const point = geometryOf('Point');

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' });

export const timestamptz = () => timestamp({ withTimezone: true });

/** Integer paise (G9). Always bigint in TypeScript — never a JS number. */
export const paise = () => bigint({ mode: 'bigint' });

export const id = () => uuid().primaryKey().defaultRandom();

/**
 * On every table (§10.1). Defaults use app_now(), which returns ClockService's time for request
 * transactions (withScope sets `app.now`) so a frozen demo clock is honoured by the DB too (G16).
 * updated_at is maintained by trg_updated_at.
 */
export const stamps = {
  createdAt: timestamptz()
    .notNull()
    .default(sql`app_now()`),
  updatedAt: timestamptz().default(sql`app_now()`),
  createdBy: uuid(),
};
