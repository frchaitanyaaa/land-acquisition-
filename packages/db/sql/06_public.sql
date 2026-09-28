-- Public surface (§25, G22). Public (no-login) handlers run as app_user with an EMPTY scope, so RLS
-- hides every table. They read and write ONLY through these public_* views and functions, owned
-- by app_worker, each returning the minimum a citizen needs — never hold reasons, phones, bank refs.

SET ROLE app_worker;

-- ---------------------------------------------------------------------------------------------
-- Parcel status search: village + survey number → project, stage, status. No personal data.
DROP VIEW IF EXISTS public_parcel_status CASCADE;
CREATE VIEW public_parcel_status AS
SELECT lp.village_code, v.name AS village_name, v.name_local AS village_name_local,
       lp.survey_number, lp.sub_division, lp.survey_number || coalesce('/' || lp.sub_division, '') AS survey_no,
       p.code AS project_code, p.name AS project_name, p.status AS project_status, p.current_stage,
       pp.status AS parcel_status, pp.affected_pct, lp.transfer_frozen_at IS NOT NULL AS transfer_frozen,
       d.name AS district_name,
       (SELECT max(doc.uploaded_at) FROM documents doc WHERE doc.project_id = p.id
          AND doc.doc_type IN ('S11_NOTIFICATION','S19_DECLARATION','RNR_SCHEME_APPROVED')) AS last_public_notice_at
FROM project_parcels pp
JOIN land_parcels lp ON lp.id = pp.parcel_id
JOIN villages v ON v.code = lp.village_code
JOIN sub_districts sd ON sd.code = v.sub_district_code
JOIN districts d ON d.code = sd.district_code
JOIN projects p ON p.id = pp.project_id
WHERE p.status NOT IN ('DRAFT');

-- Published notices (s.11, s.19, R&R scheme) with document ids for download.
DROP VIEW IF EXISTS public_notices CASCADE;
CREATE VIEW public_notices AS
SELECT doc.id AS document_id, doc.doc_type, doc.title, doc.language, doc.uploaded_at AS published_at, doc.sha256,
       p.code AS project_code, p.name AS project_name, p.state_code
FROM documents doc JOIN projects p ON p.id = doc.project_id
WHERE doc.doc_type IN ('S11_NOTIFICATION','S19_DECLARATION','RNR_SCHEME_APPROVED','GAZETTE_COPY','DENOTIFICATION_ORDER')
  AND NOT EXISTS (SELECT 1 FROM documents n WHERE n.supersedes_id = doc.id);

-- ---------------------------------------------------------------------------------------------
-- Token helpers. Tokens are single-use; the hash (never the token) is stored.

CREATE OR REPLACE FUNCTION public_token(p_hash text, p_purpose access_token_purpose)
RETURNS TABLE (token_id uuid, person_id uuid, subject_id uuid, issued_by_post_id uuid, expired boolean, used boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, person_id, subject_id, issued_by_post_id, expires_at < app_now(), used_at IS NOT NULL
  FROM access_tokens WHERE token_hash = p_hash AND purpose = p_purpose
$$;

-- What the family sees on the acknowledgement page: the payment, never why anything was held.
CREATE OR REPLACE FUNCTION public_ack_context(p_hash text)
RETURNS TABLE (disbursement_id uuid, amount_paise bigint, head_code text, paid_on date, payment_status payment_status,
               instrument payment_instrument, project_code text, project_name text, person_first_name text,
               acknowledged boolean, has_credential boolean, expired boolean, used boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.amount_paise, e.head_code, d.paid_on, d.payment_status, d.instrument, p.code, p.name,
         split_part(pe.full_name, ' ', 1),
         EXISTS (SELECT 1 FROM acknowledgements a WHERE a.disbursement_id = d.id),
         EXISTS (SELECT 1 FROM webauthn_credentials c WHERE c.person_id = t.person_id AND c.revoked_at IS NULL),
         t.expires_at < app_now(), t.used_at IS NOT NULL
  FROM access_tokens t
  JOIN disbursements d ON d.id = t.subject_id
  JOIN entitlements e ON e.id = d.entitlement_id
  JOIN affected_families af ON af.id = e.affected_family_id
  JOIN projects p ON p.id = af.project_id
  JOIN persons pe ON pe.id = t.person_id
  WHERE t.token_hash = p_hash AND t.purpose = 'acknowledge'
$$;

CREATE OR REPLACE FUNCTION public_person_credentials(p_hash text)
RETURNS TABLE (credential_id text, public_key bytea, counter bigint, transports text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.credential_id, c.public_key, c.counter, c.transports
  FROM access_tokens t JOIN webauthn_credentials c ON c.person_id = t.person_id AND c.revoked_at IS NULL
  WHERE t.token_hash = p_hash AND t.expires_at >= app_now() AND t.used_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public_enrol_person(p_hash text)
RETURNS TABLE (person_id uuid, display_name text, expired boolean, used boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.person_id, split_part(pe.full_name, ' ', 1), t.expires_at < app_now(), t.used_at IS NOT NULL
  FROM access_tokens t JOIN persons pe ON pe.id = t.person_id WHERE t.token_hash = p_hash AND t.purpose = 'enrol'
$$;

-- Witnessed enrolment (§21.2): the issuing officer's post is the witness. Returns the credential row id.
CREATE OR REPLACE FUNCTION public_enrol_credential(p_hash text, p_credential_id text, p_public_key bytea, p_counter bigint,
                                                   p_transports text[], p_device_label text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t access_tokens; cid uuid;
BEGIN
  SELECT * INTO t FROM access_tokens WHERE token_hash = p_hash AND purpose = 'enrol' FOR UPDATE;
  IF t.id IS NULL OR t.used_at IS NOT NULL OR t.expires_at < app_now() THEN
    RAISE EXCEPTION 'enrolment link is invalid, used or expired' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO webauthn_credentials (person_id, credential_id, public_key, counter, transports, device_label, enrolled_at, enrolled_witness_post_id)
  VALUES (t.person_id, p_credential_id, p_public_key, p_counter, p_transports, p_device_label, app_now(), t.issued_by_post_id)
  RETURNING id INTO cid;
  UPDATE access_tokens SET used_at = app_now() WHERE id = t.id;
  INSERT INTO audit_log (at, action, entity_type, entity_id, after)
  VALUES (app_now(), 'WEBAUTHN_ENROLLED', 'webauthn_credential', cid,
          jsonb_build_object('personId', t.person_id, 'witnessPostId', t.issued_by_post_id));
  INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload)
  VALUES ('WEBAUTHN_ENROLLED', 'webauthn_credential', cid,
          jsonb_build_object('credentialRowId', cid, 'witnessPostId', t.issued_by_post_id, 'at', app_now()));
  RETURN cid;
END $$;

-- Records the family's acknowledgement. The caller (API) has already verified the WebAuthn
-- assertion or the OTP; this enforces the token, the payment state and single acknowledgement.
CREATE OR REPLACE FUNCTION public_acknowledge(p_hash text, p_method ack_method, p_credential_id text,
                                              p_assertion_sha256 text, p_otp_ref text, p_new_counter bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t access_tokens; d disbursements; aid uuid; ent uuid;
BEGIN
  IF p_method NOT IN ('WEBAUTHN', 'OTP') THEN
    RAISE EXCEPTION 'officer-attested acknowledgements are not recorded through the public page' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO t FROM access_tokens WHERE token_hash = p_hash AND purpose = 'acknowledge' FOR UPDATE;
  IF t.id IS NULL OR t.used_at IS NOT NULL OR t.expires_at < app_now() THEN
    RAISE EXCEPTION 'acknowledgement link is invalid, used or expired' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM disbursements WHERE id = t.subject_id FOR UPDATE;
  IF d.payment_status <> 'SUCCESS' THEN
    RAISE EXCEPTION 'this payment has not succeeded yet' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO acknowledgements (disbursement_id, method, webauthn_credential_id, assertion_sha256, otp_ref, confirmed_at)
  VALUES (d.id, p_method, p_credential_id, p_assertion_sha256, p_otp_ref, app_now())
  RETURNING id INTO aid;
  IF p_method = 'WEBAUTHN' THEN
    UPDATE webauthn_credentials SET counter = p_new_counter WHERE credential_id = p_credential_id AND person_id = t.person_id;
  END IF;
  UPDATE access_tokens SET used_at = app_now() WHERE id = t.id;
  ent := d.entitlement_id;
  -- The entitlement is acknowledged once every successful DBT payment on it is acknowledged.
  UPDATE entitlements e SET status = 'ACKNOWLEDGED'
  WHERE e.id = ent AND e.status = 'DISBURSED'
    AND NOT EXISTS (SELECT 1 FROM disbursements x WHERE x.entitlement_id = ent AND x.payment_status = 'SUCCESS'
                    AND x.instrument = 'DBT' AND NOT EXISTS (SELECT 1 FROM acknowledgements a WHERE a.disbursement_id = x.id));
  INSERT INTO audit_log (at, action, entity_type, entity_id, after)
  VALUES (app_now(), 'COMPENSATION_ACKNOWLEDGED', 'acknowledgement', aid,
          jsonb_build_object('disbursementId', d.id, 'method', p_method));
  INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload)
  VALUES ('COMPENSATION_ACKNOWLEDGED', 'acknowledgement', aid,
          jsonb_build_object('acknowledgementId', aid, 'disbursementId', d.id, 'entitlementId', ent, 'method', p_method,
                             'credentialId', p_credential_id, 'confirmedAt', app_now()));
  RETURN aid;
END $$;

-- "I did not receive this" (§21.2): flags the entitlement DISPUTED for the Collector.
CREATE OR REPLACE FUNCTION public_dispute(p_hash text, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t access_tokens; d disbursements; pid uuid;
BEGIN
  SELECT * INTO t FROM access_tokens WHERE token_hash = p_hash AND purpose = 'acknowledge' FOR UPDATE;
  IF t.id IS NULL OR t.used_at IS NOT NULL OR t.expires_at < app_now() THEN
    RAISE EXCEPTION 'acknowledgement link is invalid, used or expired' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO d FROM disbursements WHERE id = t.subject_id;
  UPDATE entitlements SET status = 'DISPUTED' WHERE id = d.entitlement_id;
  UPDATE access_tokens SET used_at = app_now() WHERE id = t.id;
  SELECT af.project_id INTO pid FROM entitlements e JOIN affected_families af ON af.id = e.affected_family_id WHERE e.id = d.entitlement_id;
  INSERT INTO audit_log (at, action, entity_type, entity_id, after)
  VALUES (app_now(), 'ACK_DISPUTED', 'disbursement', d.id, jsonb_build_object('reason', left(p_reason, 2000)));
  INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload)
  VALUES ('ACK_DISPUTED', 'disbursement', d.id, jsonb_build_object('disbursementId', d.id, 'projectId', pid, 'at', app_now()));
  RETURN d.id;
END $$;

-- Digital R&R passbook (§19): heads, amounts, status, due dates, site — never hold reasons.
CREATE OR REPLACE FUNCTION public_passbook(p_hash text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'family', jsonb_build_object('headFirstName', split_part(pe.full_name, ' ', 1), 'projectCode', p.code, 'projectName', p.name,
                                 'isDisplaced', af.is_displaced),
    'entitlements', coalesce((SELECT jsonb_agg(jsonb_build_object(
          'headCode', e.head_code, 'amountPaise', e.amount_awarded_paise::text, 'status',
          CASE WHEN e.status IN ('ASSESSED','SANCTIONED') THEN 'PAYMENT_IN_PROCESS' ELSE e.status::text END,
          'dueBy', e.due_by,
          'paidPaise', (SELECT coalesce(sum(d.amount_paise),0)::text FROM disbursements d WHERE d.entitlement_id = e.id AND d.payment_status = 'SUCCESS'),
          'acknowledged', EXISTS (SELECT 1 FROM disbursements d JOIN acknowledgements a ON a.disbursement_id = d.id WHERE d.entitlement_id = e.id))
          ORDER BY e.head_code) FROM entitlements e WHERE e.affected_family_id = af.id), '[]'::jsonb),
    'annuity', (SELECT jsonb_build_object('paid', count(*) FILTER (WHERE s.status = 'paid'), 'total', count(*),
                                          'nextDue', min(s.due_on) FILTER (WHERE s.status = 'scheduled'))
                FROM annuity_schedules s JOIN entitlements e ON e.id = s.entitlement_id WHERE e.affected_family_id = af.id),
    'site', (SELECT jsonb_build_object('name', rs.name,
                     'readinessPct', round(100.0 * count(m.*) FILTER (WHERE m.status = 'complete') / nullif(count(m.*), 0)))
             FROM resettlement_sites rs LEFT JOIN amenity_milestones m ON m.site_id = rs.id WHERE rs.id = af.resettlement_site_id GROUP BY rs.name),
    'contact', 'Office of the Collector / Administrator for R&R',
    'asOf', app_now())
  FROM access_tokens t
  JOIN affected_families af ON af.id = t.subject_id
  JOIN persons pe ON pe.id = af.head_person_id
  JOIN projects p ON p.id = af.project_id
  WHERE t.token_hash = p_hash AND t.purpose = 'passbook' AND t.expires_at >= app_now()
$$;

RESET ROLE;

GRANT SELECT ON public_parcel_status, public_notices TO app_user;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public_token(text, access_token_purpose)', 'public_ack_context(text)', 'public_person_credentials(text)',
                           'public_enrol_person(text)', 'public_enrol_credential(text, text, bytea, bigint, text[], text)',
                           'public_acknowledge(text, ack_method, text, text, text, bigint)', 'public_dispute(text, text)',
                           'public_passbook(text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO app_user', f);
  END LOOP;
END $$;

-- Citizen objection during an open s.15 window (§25). Identifies the project and parcel by public
-- codes; refuses once the OBJECTION_WINDOW (or its sector-act equivalent) has elapsed.
SET ROLE app_worker;
CREATE OR REPLACE FUNCTION public_file_objection(p_project_code text, p_village_code text, p_survey_no text,
                                                 p_name text, p_body text, p_language text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; parcel uuid; oid uuid; open_window boolean;
BEGIN
  SELECT id INTO pid FROM projects WHERE code = p_project_code AND status = 'ACTIVE';
  IF pid IS NULL THEN RAISE EXCEPTION 'no active project with that code' USING ERRCODE = 'P0001'; END IF;
  SELECT EXISTS (SELECT 1 FROM statutory_deadlines d WHERE d.project_id = pid AND d.clock_code IN ('OBJECTION_WINDOW','NH_OBJECTION_WINDOW')
                 AND d.started_at <= app_now() AND d.due_at >= app_now()) INTO open_window;
  IF NOT open_window THEN RAISE EXCEPTION 'the objection window for this project is not open' USING ERRCODE = 'P0001'; END IF;
  SELECT lp.id INTO parcel FROM land_parcels lp JOIN project_parcels pp ON pp.parcel_id = lp.id AND pp.project_id = pid
  WHERE lp.village_code = p_village_code AND lp.survey_number || coalesce('/' || lp.sub_division, '') = p_survey_no LIMIT 1;
  INSERT INTO objections (project_id, parcel_id, channel, filed_at, language, body, status)
  VALUES (pid, parcel, 'portal', app_now(), p_language, left(coalesce(p_name, 'Anonymous') || ': ' || p_body, 20000), 'FILED')
  RETURNING id INTO oid;
  INSERT INTO audit_log (at, action, entity_type, entity_id, after) VALUES (app_now(), 'OBJECTION_FILED_PUBLIC', 'objection', oid, jsonb_build_object('projectId', pid));
  INSERT INTO outbox_events (type, aggregate_type, aggregate_id, payload) VALUES ('OBJECTION_FILED', 'objection', oid, jsonb_build_object('projectId', pid, 'channel', 'portal'));
  RETURN oid;
END $$;
RESET ROLE;
REVOKE ALL ON FUNCTION public_file_objection(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public_file_objection(text, text, text, text, text, text) TO app_user;
