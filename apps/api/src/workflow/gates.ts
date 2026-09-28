import type { Tx } from '@bhoomisetu/db';
import { sql } from 'drizzle-orm';
import { one } from '../common/db/raw';

/**
 * Gate / event checklist items resolved from domain state (evidence, not tick-boxes). An item with
 * no resolver here falls back to the stage_checklist row its owning module sets.
 */
const RESOLVERS: Record<string, (projectId: string) => ReturnType<typeof sql>> = {
  ESCROW_INITIAL_FUNDED: (p) =>
    sql`SELECT EXISTS (SELECT 1 FROM escrow_accounts WHERE project_id = ${p} AND gate = 'INITIAL' AND status IN ('funded','certified')) AS ok`,
  ESCROW_FULL_CERTIFIED: (p) =>
    sql`SELECT EXISTS (SELECT 1 FROM escrow_accounts WHERE project_id = ${p} AND gate = 'FULL' AND status = 'certified') AS ok`,
  OBJECTIONS_DISPOSED: (p) =>
    sql`SELECT NOT EXISTS (SELECT 1 FROM objections WHERE project_id = ${p} AND status IN ('FILED','SCHEDULED','HEARD')) AS ok`,
  CONSENT_THRESHOLD_MET: (p) =>
    sql`SELECT coalesce(bool_or(met), false) AS ok FROM v_consent_tally WHERE project_id = ${p} AND status = 'certified'`,
  EXPERT_RECOMMENDATION_SIGNED: (p) =>
    sql`SELECT EXISTS (SELECT 1 FROM expert_recommendations WHERE project_id = ${p} AND signed_at IS NOT NULL) AS ok`,
  AWARD_CHECKS_PASSED: (p) =>
    sql`SELECT EXISTS (SELECT 1 FROM awards WHERE project_id = ${p} AND award_type = 'LAND')
          AND NOT EXISTS (SELECT 1 FROM stage_checklist sc JOIN stage_instances si ON si.id = sc.stage_instance_id
                          WHERE si.project_id = ${p} AND sc.item_code = 'AWARD_CHECKS_FAILED' AND sc.satisfied) AS ok`,
  ALL_PARCELS_POSSESSED: (p) =>
    sql`SELECT count(*) > 0 AND count(*) FILTER (WHERE status NOT IN ('ACQUIRED_POSSESSED','CLOSED','DENOTIFIED','TERMINATED')) = 0 AS ok
        FROM project_parcels WHERE project_id = ${p}`,
  ALL_PARCELS_CLOSED: (p) =>
    sql`SELECT count(*) > 0 AND count(*) FILTER (WHERE status NOT IN ('CLOSED','DENOTIFIED','TERMINATED')) = 0 AS ok
        FROM project_parcels WHERE project_id = ${p}`,
  NO_OPEN_LEGAL_CASES: (p) =>
    sql`SELECT NOT EXISTS (SELECT 1 FROM legal_cases WHERE project_id = ${p} AND status <> 'closed') AS ok`,
};

export const hasResolver = (code: string) => code in RESOLVERS;

export async function resolveGate(tx: Tx, projectId: string, code: string): Promise<boolean | undefined> {
  const q = RESOLVERS[code];
  if (!q) return undefined;
  return (await one<{ ok: boolean }>(tx, q(projectId)))?.ok ?? false;
}
