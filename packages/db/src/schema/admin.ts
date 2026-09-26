import { pgTable, text } from 'drizzle-orm/pg-core';
import { multiPolygon, stamps } from './_columns';
import { dataSourceEnum } from './enums';

// Administrative hierarchy, keyed by LGD code (§10.3). Reference data: readable by every role,
// written only by the seed. Until data/lgd is loaded, codes below state level are `SYN-…`.

export const states = pgTable('states', {
  code: text().primaryKey(),
  name: text().notNull(),
  nameLocal: text(),
  ...stamps,
});

export const districts = pgTable('districts', {
  code: text().primaryKey(),
  stateCode: text()
    .notNull()
    .references(() => states.code),
  name: text().notNull(),
  nameLocal: text(),
  ...stamps,
});

/** Taluka / tehsil. */
export const subDistricts = pgTable('sub_districts', {
  code: text().primaryKey(),
  districtCode: text()
    .notNull()
    .references(() => districts.code),
  name: text().notNull(),
  nameLocal: text(),
  ...stamps,
});

export const villages = pgTable('villages', {
  code: text().primaryKey(),
  subDistrictCode: text()
    .notNull()
    .references(() => subDistricts.code),
  name: text().notNull(),
  nameLocal: text(),
  boundary: multiPolygon(),
  dataSource: dataSourceEnum().notNull(),
  ...stamps,
});
