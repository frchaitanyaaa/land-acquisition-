-- Domain SQL (GIS, §15). SECURITY INVOKER: they run under the caller's RLS scope, so a district
-- post intersects only the parcels it can see. Seed and jobs call them as app_worker.

-- §15.2 Corridor → parcel intersection. Returns the number of project parcels written.
CREATE OR REPLACE FUNCTION intersect_project_parcels(pid uuid, min_sqm numeric DEFAULT 1.0)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  WITH hits AS (
    SELECT p.id AS project_id, lp.id AS parcel_id,
           ST_Multi(ST_CollectionExtract(ST_Intersection(lp.geom, p.footprint), 3)) AS g,
           lp.geom AS parcel_geom, p.is_linear, p.alignment
    FROM projects p JOIN land_parcels lp ON ST_Intersects(lp.geom, p.footprint)
    WHERE p.id = pid AND p.footprint IS NOT NULL
  )
  INSERT INTO project_parcels (project_id, parcel_id, affected_geom, affected_area_sqm, affected_pct, chainage_km, status)
  SELECT project_id, parcel_id, g, area_sqm(g),
         least(100, round(100 * ST_Area(g::geography)::numeric / nullif(ST_Area(parcel_geom::geography)::numeric, 0), 2)),
         CASE WHEN is_linear AND alignment IS NOT NULL THEN chainage_km(alignment, g) END,
         'PROPOSED'
  FROM hits WHERE NOT ST_IsEmpty(g) AND ST_Area(g::geography) > min_sqm
  ON CONFLICT (project_id, parcel_id) DO UPDATE
    SET affected_geom = EXCLUDED.affected_geom, affected_area_sqm = EXCLUDED.affected_area_sqm,
        affected_pct = EXCLUDED.affected_pct, chainage_km = EXCLUDED.chainage_km;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Affected-family stubs from parcel interests (one per head person per project, s.3).
CREATE OR REPLACE FUNCTION create_family_stubs(pid uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO affected_families (project_id, head_person_id, affected_type, is_sc_st, authorised_recipient_person_id, data_source)
  SELECT DISTINCT ON (pi.person_id) pid, pi.person_id,
         CASE WHEN pi.interest_type IN ('OWNER','MORTGAGEE','EASEMENT') THEN 'LAND_LOSER'::affected_type
              WHEN pi.interest_type = 'FOREST_RIGHT_HOLDER' THEN 'FOREST_DWELLER'::affected_type
              ELSE 'LIVELIHOOD_DEPENDENT'::affected_type END,
         pe.social_category IN ('SC','ST'), pi.person_id, pe.data_source
  FROM project_parcels pp
  JOIN parcel_interests pi ON pi.parcel_id = pp.parcel_id
  JOIN persons pe ON pe.id = pi.person_id
  WHERE pp.project_id = pid
    AND NOT EXISTS (SELECT 1 FROM affected_families af WHERE af.project_id = pid AND af.head_person_id = pi.person_id)
  ORDER BY pi.person_id, (pi.interest_type = 'OWNER') DESC;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- §15.5 Constraint screening. Writes spatial_flags (once per parcel/flag/layer) and the flags
-- array on project_parcels. Thresholds come from the pinned pack (G8).
CREATE OR REPLACE FUNCTION screen_project_constraints(pid uuid) RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer := 0; k integer; mismatch_pct numeric;
BEGIN
  SELECT (rp.definition #>> '{thresholds,areaMismatchFlagPct}')::numeric INTO mismatch_pct
  FROM projects p JOIN rule_packs rp ON rp.code = p.rule_pack_code AND rp.version = p.rule_pack_version WHERE p.id = pid;

  -- Constraint layers
  WITH hit AS (
    SELECT pp.id AS ppid, c.layer_type, c.name, area_sqm(ST_Intersection(c.geom, pp.affected_geom)) AS a
    FROM project_parcels pp JOIN constraint_layers c ON ST_Intersects(c.geom, pp.affected_geom)
    WHERE pp.project_id = pid
  )
  INSERT INTO spatial_flags (project_id, project_parcel_id, layer_type, flag_type, overlap_area_sqm, message, raised_at)
  SELECT pid, ppid, layer_type, 'CONSTRAINT_HIT', a,
         CASE layer_type
           WHEN 'IRRIGATED_MULTICROP' THEN 'Irrigated multi-cropped land (s.10) — last-resort justification and wasteland plan required'
           WHEN 'SCHEDULED_AREA' THEN 'Scheduled Area (s.41) — Gram Sabha consent and Development Plan required'
           WHEN 'PROTECTED_FOREST' THEN 'Intersects protected forest: ' || name
           WHEN 'ECO_SENSITIVE' THEN 'Intersects eco-sensitive zone: ' || name
           ELSE 'Intersects water body: ' || name END,
         app_now()
  FROM hit h WHERE NOT EXISTS (SELECT 1 FROM spatial_flags f WHERE f.project_parcel_id = h.ppid AND f.flag_type = 'CONSTRAINT_HIT' AND f.layer_type = h.layer_type);
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Parcels recorded as irrigated multi-crop (s.10) even without a layer
  INSERT INTO spatial_flags (project_id, project_parcel_id, layer_type, flag_type, overlap_area_sqm, message, raised_at)
  SELECT pid, pp.id, 'IRRIGATED_MULTICROP', 'CONSTRAINT_HIT', pp.affected_area_sqm,
         'Irrigated multi-cropped land (s.10) — last-resort justification and wasteland plan required', app_now()
  FROM project_parcels pp JOIN land_parcels lp ON lp.id = pp.parcel_id
  WHERE pp.project_id = pid AND lp.is_irrigated_multicrop
    AND NOT EXISTS (SELECT 1 FROM spatial_flags f WHERE f.project_parcel_id = pp.id AND f.layer_type = 'IRRIGATED_MULTICROP');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Cross-project overlap
  INSERT INTO spatial_flags (project_id, project_parcel_id, flag_type, overlap_area_sqm, message, raised_at)
  SELECT pid, pp.id, 'OVERLAP', area_sqm(ST_Intersection(pp.affected_geom, o.affected_geom)),
         'Parcel also affected by project ' || op.code, app_now()
  FROM project_parcels pp
  JOIN project_parcels o ON o.parcel_id = pp.parcel_id AND o.project_id <> pp.project_id
  JOIN projects op ON op.id = o.project_id AND op.status NOT IN ('TERMINATED','DENOTIFIED','ABANDONED','LAPSED','CLOSED')
  WHERE pp.project_id = pid
    AND NOT EXISTS (SELECT 1 FROM spatial_flags f WHERE f.project_parcel_id = pp.id AND f.flag_type = 'OVERLAP');
  GET DIAGNOSTICS k = ROW_COUNT; n := n + k;

  -- Flags array on project_parcels
  UPDATE project_parcels pp SET flags = (
    SELECT coalesce(array_agg(DISTINCT f), '{}')::parcel_flag[] FROM (
      SELECT unnest(pp.flags) AS f WHERE false
      UNION SELECT 'CONSTRAINT_HIT'::parcel_flag WHERE EXISTS (SELECT 1 FROM spatial_flags s WHERE s.project_parcel_id = pp.id AND s.flag_type = 'CONSTRAINT_HIT')
      UNION SELECT 'OVERLAP'::parcel_flag WHERE EXISTS (SELECT 1 FROM spatial_flags s WHERE s.project_parcel_id = pp.id AND s.flag_type = 'OVERLAP')
      UNION SELECT 'AREA_MISMATCH'::parcel_flag FROM land_parcels lp WHERE lp.id = pp.parcel_id AND abs(lp.area_diff_pct) > mismatch_pct
      UNION SELECT 'OUTSIDE_VILLAGE'::parcel_flag FROM land_parcels lp JOIN villages v ON v.code = lp.village_code
            WHERE lp.id = pp.parcel_id AND v.boundary IS NOT NULL
              AND NOT ST_Within(lp.geom, ST_Buffer(v.boundary::geography, 20)::geometry)
      UNION SELECT f FROM unnest(pp.flags) f WHERE f IN ('DISPUTED','DELAYED')
    ) x)
  WHERE pp.project_id = pid;

  -- projects.in_scheduled_area is set only at pre-scrutiny (draft): flipping it later would
  -- change which stages apply to a project already under way.
  RETURN n;
END $$;
