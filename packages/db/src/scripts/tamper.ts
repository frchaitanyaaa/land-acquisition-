import { createPool } from '../client';
import { loadRootEnv, requireEnv } from '../env';

// `pnpm demo:tamper` (§27.5, DEMO_MODE only): simulates a privileged SILENT database edit — shifts
// an anchored parcel's geometry by ~5 m with raw SQL as app_worker (BYPASSRLS), bypassing the API,
// the workflow, the audit log and versioning. The next verify of that parcel shows MISMATCH.
// Contrast with a legitimate correction (§15.4): a new version with its own valid anchor.

async function main() {
  loadRootEnv();
  if (process.env.DEMO_MODE !== 'true') throw new Error('demo:tamper runs only with DEMO_MODE=true');
  const pool = createPool(requireEnv('DATABASE_WORKER_URL'), { max: 1 });
  try {
    const target = process.argv[2];
    const { rows } = await pool.query<{ entity_id: string; entity_version: number }>(
      target
        ? `SELECT entity_id, entity_version FROM chain_events WHERE entity_type = 'land_parcel' AND entity_id = $1 ORDER BY entity_version DESC LIMIT 1`
        : `SELECT entity_id, entity_version FROM chain_events WHERE entity_type = 'land_parcel' AND status = 'ANCHORED' ORDER BY anchored_at DESC LIMIT 1`,
      target ? [target] : [],
    );
    const hit = rows[0];
    if (!hit) throw new Error('no anchored parcel found — verify a parcel first so it gets anchored');
    // ~5 m east at these latitudes; version NOT bumped, no audit row: that is the point.
    await pool.query(`UPDATE land_parcels SET geom = ST_Translate(geom, 0.00005, 0) WHERE id = $1`, [hit.entity_id]);
    console.log(
      `tampered land_parcel ${hit.entity_id} (v${hit.entity_version}) — GET /api/v1/chain/verify/land_parcel/${hit.entity_id} now reports MISMATCH`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
