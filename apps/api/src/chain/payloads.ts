import { createHash } from 'node:crypto';
import type { Tx } from '@bhoomisetu/db';
import { canonicalJson } from '@bhoomisetu/shared';
import { keccak256, toUtf8Bytes } from 'ethers';
import { sql } from 'drizzle-orm';

// Canonical anchor payloads (§27.2). THE ONLY code that decides what is hashed; the anchor job and
// the verify endpoint both call these builders. Defined projections, never whole rows, and never
// names, phones, bank references or any other personal data.

export type AnchorEntity =
  | 'land_parcel'
  | 'stage_instance'
  | 'award'
  | 'disbursement'
  | 'acknowledgement'
  | 'project_parcel'
  | 'document'
  | 'webauthn_credential';

export interface Built {
  eventType: string;
  payload: Record<string, unknown>;
}

async function one<T>(tx: Tx, q: ReturnType<typeof sql>): Promise<T | undefined> {
  return ((await tx.execute(q)) as unknown as { rows: T[] }).rows[0];
}

const iso = (d: unknown) =>
  d instanceof Date ? d.toISOString() : d == null ? null : new Date(String(d)).toISOString();

/** Rebuilds the payload for (entity, version) from the CURRENT database row. Null if the row is gone. */
export async function buildPayload(
  tx: Tx,
  entityType: AnchorEntity,
  entityId: string,
  version: number,
): Promise<Built | null> {
  switch (entityType) {
    case 'land_parcel': {
      // geom_canonical_hash() is recomputed from the geometry (G11): a silent geometry edit that
      // bypassed the trigger still changes the hash.
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT lp.id, lp.version AS version_now, lp.village_code, lp.survey_number, lp.sub_division, lp.boundary_source, lp.field_area_sqm, lp.recorded_area_sqm,
                   CASE WHEN lp.version = ${version} THEN geom_canonical_hash(lp.geom) ELSE v.geom_hash END AS geom_hash,
                   p.rule_pack_code || '@' || p.rule_pack_version AS rule_pack
            FROM land_parcels lp
            LEFT JOIN land_parcels_versions v ON v.id = lp.id AND v.version = ${version}
            LEFT JOIN LATERAL (SELECT pr.rule_pack_code, pr.rule_pack_version FROM project_parcels pp JOIN projects pr ON pr.id = pp.project_id
                               WHERE pp.parcel_id = lp.id ORDER BY pr.code LIMIT 1) p ON true
            WHERE lp.id = ${entityId} AND (lp.version = ${version} OR v.id IS NOT NULL)`,
      );
      if (!r) return null;
      return {
        eventType: version > 1 ? 'PARCEL_CORRECTED' : 'PARCEL_VERIFIED',
        payload: {
          entityType,
          entityId,
          version,
          villageCode: r.village_code,
          surveyNumber: r.survey_number,
          subDivision: r.sub_division ?? null,
          geomHash: r.geom_hash,
          boundarySource: r.boundary_source,
          rulePack: r.rule_pack ?? null,
          ...(version === r.version_now
            ? { fieldAreaSqm: r.field_area_sqm ?? null, recordedAreaSqm: r.recorded_area_sqm ?? null }
            : {}),
        },
      };
    }
    case 'stage_instance': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT si.project_id, si.stage_code, si.attempt, t.action, t.reason_code, t.actor_post_id, t.at,
                   (SELECT coalesce(array_agg(d.sha256 ORDER BY d.sha256), '{}') FROM documents d WHERE d.id = ANY(t.document_ids)) AS shas
            FROM stage_instances si
            JOIN LATERAL (SELECT * FROM stage_transitions st WHERE st.stage_instance_id = si.id
                          AND st.action IN ('APPROVE','APPROVE_CONDITIONAL','OVERRIDE') ORDER BY st.at DESC LIMIT 1) t ON true
            WHERE si.id = ${entityId} AND si.attempt = ${version}`,
      );
      if (!r) return null;
      return {
        eventType: 'APPROVAL_RECORDED',
        payload: {
          projectId: r.project_id,
          stageCode: r.stage_code,
          attempt: r.attempt,
          action: r.action,
          reasonCode: r.reason_code ?? null,
          actorPostId: r.actor_post_id,
          at: iso(r.at),
          documentSha256s: r.shas,
        },
      };
    }
    case 'award': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT a.id, a.project_id, a.award_no, a.version, a.collector_post_id, a.pronounced_at,
                   (SELECT sha256 FROM documents WHERE id = a.document_id) AS doc_sha,
                   (SELECT coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'headCode', e.head_code, 'amountPaise', e.amount_awarded_paise::text) ORDER BY e.id), '[]')
                    FROM entitlements e WHERE e.award_id = a.id) AS ents
            FROM awards a WHERE a.id = ${entityId} AND a.version = ${version} AND a.status = 'signed'`,
      );
      if (!r) return null;
      return {
        eventType: 'AWARD_DECLARED',
        payload: {
          awardId: r.id,
          projectId: r.project_id,
          awardNo: r.award_no,
          version: r.version,
          awardDocSha256: r.doc_sha ?? null,
          entitlements: r.ents,
          signedByPostId: r.collector_post_id,
          signedAt: iso(r.pronounced_at),
        },
      };
    }
    case 'disbursement': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT id, entitlement_id, amount_paise::text AS amount, instrument, paid_on::text AS paid_on, adapter_ref FROM disbursements
            WHERE id = ${entityId} AND payment_status = 'SUCCESS'`,
      );
      if (!r) return null;
      return {
        eventType: 'COMPENSATION_DISBURSED',
        payload: {
          disbursementId: r.id,
          entitlementId: r.entitlement_id,
          amountPaise: r.amount,
          instrument: r.instrument,
          paidOn: r.paid_on,
          adapterRef: r.adapter_ref ?? null,
        },
      };
    }
    case 'acknowledgement': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT id, disbursement_id, method, webauthn_credential_id, confirmed_at, witness_post_id FROM acknowledgements WHERE id = ${entityId}`,
      );
      if (!r) return null;
      const cred = r.webauthn_credential_id
        ? createHash('sha256').update(String(r.webauthn_credential_id)).digest('hex')
        : null;
      return {
        eventType: 'COMPENSATION_ACKNOWLEDGED',
        payload: {
          acknowledgementId: r.id,
          disbursementId: r.disbursement_id,
          method: r.method,
          credentialIdSha256: cred,
          confirmedAt: iso(r.confirmed_at),
          witnessPostId: r.witness_post_id ?? null,
        },
      };
    }
    case 'project_parcel': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT pe.project_parcel_id, pp.parcel_id, pe.taken_by_post_id, pe.taken_at, (SELECT sha256 FROM documents WHERE id = pe.panchnama_document_id) AS panchnama
            FROM possession_events pe JOIN project_parcels pp ON pp.id = pe.project_parcel_id WHERE pe.project_parcel_id = ${entityId}`,
      );
      if (!r) return null;
      return {
        eventType: 'POSSESSION_CONFIRMED',
        payload: {
          projectParcelId: r.project_parcel_id,
          parcelId: r.parcel_id,
          panchnamaSha256: r.panchnama ?? null,
          takenByPostId: r.taken_by_post_id,
          takenAt: iso(r.taken_at),
        },
      };
    }
    case 'document': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT d.id, d.sha256, a.post_id, a.declaration_version, a.attested_at FROM documents d JOIN attestations a ON a.document_id = d.id
            WHERE d.id = ${entityId} AND d.version = ${version}`,
      );
      if (!r) return null;
      return {
        eventType: 'DOCUMENT_ATTESTED',
        payload: {
          documentId: r.id,
          sha256: r.sha256,
          postId: r.post_id,
          declarationVersion: r.declaration_version,
          attestedAt: iso(r.attested_at),
        },
      };
    }
    case 'webauthn_credential': {
      const r = await one<Record<string, unknown>>(
        tx,
        sql`SELECT id, credential_id, enrolled_at, enrolled_witness_post_id FROM webauthn_credentials WHERE id = ${entityId}`,
      );
      if (!r) return null;
      return {
        eventType: 'WEBAUTHN_ENROLLED',
        payload: {
          credentialRowId: r.id,
          credentialIdSha256: createHash('sha256').update(String(r.credential_id)).digest('hex'),
          enrolledAt: iso(r.enrolled_at),
          witnessPostId: r.enrolled_witness_post_id ?? null,
        },
      };
    }
  }
}

/** 0x + sha256(JCS(payload)) (§27.2). */
export function dataHash(payload: Record<string, unknown>): string {
  return `0x${createHash('sha256').update(canonicalJson(payload)).digest('hex')}`;
}

/** Contract key: keccak256(abi.encodePacked(entityType, ":", entityId)). */
export function anchorKey(entityType: string, entityId: string): string {
  return keccak256(toUtf8Bytes(`${entityType}:${entityId}`));
}

/** Which outbox events are anchor-worthy, and what they anchor (§12.8). */
export function anchorTarget(e: {
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}): { entityType: AnchorEntity; entityId: string; version: number } | null {
  const v = (x: unknown, d = 1) => (typeof x === 'number' ? x : d);
  switch (e.type) {
    case 'PARCEL_VERIFIED':
    case 'PARCEL_CORRECTED':
      return { entityType: 'land_parcel', entityId: e.aggregateId, version: v(e.payload.version) };
    case 'STAGE_APPROVED':
      return typeof e.payload.stageInstanceId === 'string'
        ? { entityType: 'stage_instance', entityId: e.payload.stageInstanceId, version: v(e.payload.attempt) }
        : null;
    case 'AWARD_SIGNED':
      return e.aggregateType === 'award'
        ? { entityType: 'award', entityId: e.aggregateId, version: v(e.payload.version) }
        : null;
    case 'DISBURSEMENT_SUCCEEDED':
      return { entityType: 'disbursement', entityId: e.aggregateId, version: 1 };
    case 'COMPENSATION_ACKNOWLEDGED':
      return { entityType: 'acknowledgement', entityId: e.aggregateId, version: 1 };
    case 'POSSESSION_TAKEN':
      return { entityType: 'project_parcel', entityId: e.aggregateId, version: 1 };
    case 'DOCUMENT_ATTESTED':
      return { entityType: 'document', entityId: e.aggregateId, version: v(e.payload.version) };
    case 'WEBAUTHN_ENROLLED':
      return { entityType: 'webauthn_credential', entityId: e.aggregateId, version: 1 };
    default:
      return null;
  }
}
