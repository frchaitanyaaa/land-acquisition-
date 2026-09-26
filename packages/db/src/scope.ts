import type { JurisdictionLevel } from '@bhoomisetu/shared';
import { sql, type SQL } from 'drizzle-orm';
import type { Db, Tx } from './client';

// The session settings every RLS policy reads (CLAUDE.md §11.3). Set with is_local = true, so they
// live exactly as long as the transaction. A connection returned to the pool carries nothing over.

export interface Scope {
  userId: string | null;
  postId: string | null;
  level: JurisdictionLevel | null;
  stateCode: string | null;
  districtCode: string | null;
  /** PROJECT-level posts only. */
  projectIds: readonly string[];
  /** Requiring-body posts see their own projects. */
  requiringBodyId: string | null;
}

/** No login: every scoped table returns nothing. Public endpoints read public_* views instead (G22). */
export const PUBLIC_SCOPE: Scope = {
  userId: null,
  postId: null,
  level: null,
  stateCode: null,
  districtCode: null,
  projectIds: [],
  requiringBodyId: null,
};

export function scopeSettingsSql(scope: Scope, now: Date): SQL {
  return sql`SELECT
    set_config('app.user_id',            ${scope.userId ?? ''}, true),
    set_config('app.post_id',            ${scope.postId ?? ''}, true),
    set_config('app.jurisdiction_level', ${scope.level ?? ''}, true),
    set_config('app.state_code',         ${scope.stateCode ?? ''}, true),
    set_config('app.district_code',      ${scope.districtCode ?? ''}, true),
    set_config('app.project_ids',        ${scope.projectIds.join(',')}, true),
    set_config('app.requiring_body_id',  ${scope.requiringBodyId ?? ''}, true),
    set_config('app.now',                ${now.toISOString()}, true)`;
}

/** Runs `fn` in a transaction whose RLS scope and clock are `scope` and `now`. */
export function runScoped<T>(db: Db, scope: Scope, now: Date, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(scopeSettingsSql(scope, now));
    return fn(tx);
  });
}
