CREATE TYPE "public"."acceptance_type" AS ENUM('ABSOLUTE', 'UNDER_PROTEST');--> statement-breakpoint
CREATE TYPE "public"."access_token_purpose" AS ENUM('enrol', 'acknowledge', 'passbook');--> statement-breakpoint
CREATE TYPE "public"."ack_method" AS ENUM('WEBAUTHN', 'OTP', 'OFFICER_ATTESTED');--> statement-breakpoint
CREATE TYPE "public"."acquisition_type" AS ENUM('GOVERNMENT', 'PPP', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."affected_type" AS ENUM('LAND_LOSER', 'LIVELIHOOD_DEPENDENT', 'FOREST_DWELLER', 'HOMESTEAD_LOSER', 'URBAN_LIVELIHOOD');--> statement-breakpoint
CREATE TYPE "public"."amenity_status" AS ENUM('planned', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."annuity_status" AS ENUM('scheduled', 'paid', 'missed');--> statement-breakpoint
CREATE TYPE "public"."appropriate_govt" AS ENUM('state', 'central');--> statement-breakpoint
CREATE TYPE "public"."award_status" AS ENUM('draft', 'signed');--> statement-breakpoint
CREATE TYPE "public"."award_type" AS ENUM('LAND', 'RNR');--> statement-breakpoint
CREATE TYPE "public"."boundary_source" AS ENUM('CADASTRAL_IMPORT', 'FIELD_DRAWN', 'SURVEY_REFERENCE_ONLY');--> statement-breakpoint
CREATE TYPE "public"."chain_status" AS ENUM('QUEUED', 'SUBMITTED', 'ANCHORED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."checklist_item_type" AS ENUM('document', 'event', 'gate', 'hearing');--> statement-breakpoint
CREATE TYPE "public"."claim_category" AS ENUM('LAND_VALUATION', 'STRUCTURE_ASSET', 'RNR_ENTITLEMENT');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('filed', 'accepted', 'defect_memo', 'decided');--> statement-breakpoint
CREATE TYPE "public"."consent_decision" AS ENUM('CONSENT', 'REFUSE');--> statement-breakpoint
CREATE TYPE "public"."consent_entry_status" AS ENUM('eligible', 'removed');--> statement-breakpoint
CREATE TYPE "public"."consent_register_status" AS ENUM('draft', 'displayed', 'certified');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('PRIVATE_80', 'PPP_70', 'GRAM_SABHA_S41');--> statement-breakpoint
CREATE TYPE "public"."constraint_layer" AS ENUM('PROTECTED_FOREST', 'ECO_SENSITIVE', 'WATER_BODY', 'SCHEDULED_AREA', 'IRRIGATED_MULTICROP');--> statement-breakpoint
CREATE TYPE "public"."correction_status" AS ENUM('requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."cpr_type" AS ENUM('well', 'grazing', 'worship', 'school', 'clinic', 'cremation', 'pond', 'other');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('SYNTHETIC_DEMO', 'IMPORTED', 'FIELD_CAPTURED');--> statement-breakpoint
CREATE TYPE "public"."deadline_status" AS ENUM('NOT_STARTED', 'SAFE', 'DUE_SOON', 'BREACHED', 'SATISFIED', 'WAIVED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."doc_type" AS ENUM('DPR_SUMMARY', 'ADMIN_FINANCIAL_SANCTION', 'FUNDING_CLEARANCE', 'REQUISITION_APPLICATION', 'LAND_SCHEDULE_MATRIX', 'ALIGNMENT_OVERLAY_MAP', 'MIN_LAND_JUSTIFICATION', 'ORDER_OF_ACCEPTANCE', 'ESCROW_DEMAND_NOTE', 'ESCROW_DEPOSIT_RECEIPT', 'FINANCIAL_SUFFICIENCY_CERTIFICATE', 'S4_SIA_NOTIFICATION', 'SIA_AGENCY_MOU_TOR', 'SIA_CENSUS_EXPORT', 'CPR_INVENTORY_REPORT', 'SIA_REPORT_DRAFT', 'SIA_REPORT_FINAL', 'SIMP_DRAFT', 'SIMP_FINAL', 'HEARING_NOTICE', 'LOCAL_LANGUAGE_SUMMARY', 'HEARING_RECORDING', 'ATTENDANCE_REGISTER', 'HEARING_MINUTES', 'PUBLIC_HEARING_RESPONSE_MATRIX', 'EXPERT_GROUP_GAZETTE_ORDER', 'COI_DECLARATION', 'EXPERT_RECOMMENDATION_REPORT', 'DISSENT_NOTE', 'GOVERNMENT_OVERRIDE_ORDER', 'CONSENT_REGISTER_DRAFT', 'CONSENT_REGISTER_CERTIFIED', 'CONSENT_FORM', 'DLSA_OBSERVER_CERTIFICATE', 'CERTIFICATE_OF_CONSENT_PROCUREMENT', 'CONSENT_TERMINATION_ORDER', 'S11_NOTIFICATION', 'GAZETTE_COPY', 'NEWSPAPER_CLIPPING', 'AFFIXATION_CERTIFICATE', 'TRANSFER_FREEZE_ORDER', 'S12_NOTICE_OF_ENTRY', 'JOINT_INSPECTION_REPORT', 'OBJECTION_WRITTEN', 'S15_HEARING_NOTICE', 'LAO_INQUIRY_REPORT', 'GOVERNMENT_ORDER_ON_OBJECTIONS', 'DENOTIFICATION_ORDER', 'RNR_CENSUS_EXPORT', 'RNR_SCHEME_DRAFT', 'RNR_SCHEME_APPROVED', 'RNR_COMMISSIONER_ORDER', 'RESETTLEMENT_COLONY_LAYOUT', 'COMMISSIONING_CERTIFICATE', 'RNR_PASSBOOK', 'S19_DECLARATION', 'S21_NOTICE', 'CLAIM_PETITION', 'TITLE_DOCUMENT', 'VALUATION_REPORT_PWD', 'VALUATION_REPORT_FOREST', 'VALUATION_REPORT_HORTICULTURE', 'VALUATION_REPORT_IRRIGATION', 'CIRCLE_RATE_SCHEDULE', 'SALE_DEEDS_REGISTER', 'AWARD_LAND', 'AWARD_RNR', 'S37_NOTICE', 'INDEMNITY_BOND', 'PAYMENT_ACCEPTANCE_FORM', 'TREASURY_PAYMENT_ADVICE', 'VACATION_CERTIFICATE', 'S38_POSSESSION_NOTICE', 'POSSESSION_PANCHNAMA', 'CERTIFICATE_OF_POSSESSION', 'HANDOVER_CERTIFICATE', 'MUTATION_EXTRACT', 'S64_REFERENCE_APPLICATION', 'AUTHORITY_ORDER', 'APPEAL_ORDER', 'SEVERANCE_CLAIM', 'SEVERANCE_INSPECTION_REPORT', 'UTILISATION_INSPECTION_CERTIFICATE', 'REVERSION_DEED', 'VALUE_SHARING_SHEET', 'MONITORING_AUDIT_REPORT', 'ASSET_HANDOVER_CERTIFICATE', 'FIELD_PHOTO', 'PILLAR_PHOTO', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."entitlement_source" AS ENUM('manual', 'ocr_confirmed');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('ASSESSED', 'SANCTIONED', 'DISBURSED', 'ACKNOWLEDGED', 'DEPOSITED_WITH_AUTHORITY', 'DISPUTED', 'UNDER_PROTEST');--> statement-breakpoint
CREATE TYPE "public"."escrow_gate" AS ENUM('INITIAL', 'FULL');--> statement-breakpoint
CREATE TYPE "public"."escrow_status" AS ENUM('demanded', 'partially_funded', 'funded', 'certified');--> statement-breakpoint
CREATE TYPE "public"."escrow_txn_kind" AS ENUM('deposit', 'withdrawal', 'refund');--> statement-breakpoint
CREATE TYPE "public"."expert_outcome" AS ENUM('A_UNCONDITIONAL', 'B_CONDITIONAL', 'C_REJECTION');--> statement-breakpoint
CREATE TYPE "public"."field_survey_status" AS ENUM('draft', 'submitted', 'verified', 'returned');--> statement-breakpoint
CREATE TYPE "public"."hearing_status" AS ENUM('SCHEDULED', 'HELD', 'VALID', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."hearing_type" AS ENUM('SIA_PUBLIC', 'GRAM_SABHA_CONSENT', 'RNR_PUBLIC', 'S15_OBJECTION');--> statement-breakpoint
CREATE TYPE "public"."interest_type" AS ENUM('OWNER', 'TENANT', 'SHARECROPPER', 'LABOURER', 'FOREST_RIGHT_HOLDER', 'EASEMENT', 'MORTGAGEE');--> statement-breakpoint
CREATE TYPE "public"."jir_item_type" AS ENUM('TREE', 'CROP', 'WELL', 'BOREWELL', 'IRRIGATION_PIPE', 'STRUCTURE', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."jurisdiction_level" AS ENUM('NATIONAL', 'STATE', 'DISTRICT', 'PROJECT');--> statement-breakpoint
CREATE TYPE "public"."land_class" AS ENUM('IRRIGATED_MULTICROP', 'AGRICULTURAL', 'UNIRRIGATED', 'NON_AGRI_COMMERCIAL', 'RESIDENTIAL', 'GOVT_WASTE', 'FOREST');--> statement-breakpoint
CREATE TYPE "public"."legal_case_status" AS ENUM('filed', 'hearing', 'decided', 'appealed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."legal_case_type" AS ENUM('S64_REFERENCE', 'S73_REDETERMINATION', 'S74_APPEAL', 'WRIT');--> statement-breakpoint
CREATE TYPE "public"."monitoring_committee" AS ENUM('national', 'state');--> statement-breakpoint
CREATE TYPE "public"."mutation_direction" AS ENUM('pre_award_heir', 'post_possession_transfer');--> statement-breakpoint
CREATE TYPE "public"."notification_severity" AS ENUM('info', 'warn', 'critical');--> statement-breakpoint
CREATE TYPE "public"."objection_category" AS ENUM('A_PUBLIC_PURPOSE', 'B_ALIGNMENT_SHIFT', 'C_SURVEY_ERROR');--> statement-breakpoint
CREATE TYPE "public"."objection_channel" AS ENUM('portal', 'helpdesk', 'hearing_audio');--> statement-breakpoint
CREATE TYPE "public"."objection_ground" AS ENUM('AREA_SUITABILITY', 'PUBLIC_PURPOSE', 'SIA_FINDINGS');--> statement-breakpoint
CREATE TYPE "public"."objection_status" AS ENUM('FILED', 'SCHEDULED', 'HEARD', 'UPHELD', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."ocr_status" AS ENUM('pending', 'ready', 'reviewed');--> statement-breakpoint
CREATE TYPE "public"."parcel_flag" AS ENUM('DISPUTED', 'DELAYED', 'AREA_MISMATCH', 'OVERLAP', 'OUTSIDE_VILLAGE', 'CONSTRAINT_HIT');--> statement-breakpoint
CREATE TYPE "public"."parcel_status" AS ENUM('PROPOSED', 'VERIFICATION_PENDING', 'VERIFIED', 'CONSENT_ACQUIRED_NOTIFIED', 'CLEARED_FOR_AWARD_RNR', 'AWARDED', 'READY_FOR_POSSESSION', 'ACQUIRED_POSSESSED', 'CLOSED', 'DENOTIFIED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."payment_instrument" AS ENUM('DBT', 'DEPOSIT_WITH_AUTHORITY');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('INITIATED', 'PENDING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."project_category" AS ENUM('STRATEGIC_DEFENCE', 'TRANSPORT', 'ENERGY_UTILITIES', 'WATER_AGRICULTURE', 'INDUSTRIAL', 'URBAN_HOUSING', 'PUBLIC_SERVICES', 'PPP_CORPORATE');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('DRAFT', 'SUBMITTED', 'ACTIVE', 'ON_HOLD', 'TERMINATED', 'DENOTIFIED', 'ABANDONED', 'LAPSED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."requiring_body_type" AS ENUM('central', 'state', 'psu', 'private', 'ppp');--> statement-breakpoint
CREATE TYPE "public"."reversion" AS ENUM('owner', 'land_bank', 'custody_transfer');--> statement-breakpoint
CREATE TYPE "public"."rnr_scheme_status" AS ENUM('draft', 'hearing', 'committee', 'approved', 'published');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('SUPER_ADMIN', 'CENTRAL_VIEWER', 'POLICY_MAKER', 'STATE_REVENUE', 'RNR_COMMISSIONER', 'COLLECTOR', 'LAO', 'DISTRICT_STAFF', 'RNR_ADMINISTRATOR', 'TEHSILDAR', 'DILR', 'FIELD_OFFICER', 'REQUIRING_BODY', 'SIA_AGENCY', 'EXPERT_GROUP_MEMBER', 'DLSA_OBSERVER', 'TREASURY_OFFICER', 'LEGAL_CELL', 'MONITORING_COMMITTEE');--> statement-breakpoint
CREATE TYPE "public"."schedule_ref" AS ENUM('FIRST', 'SECOND', 'SC_ST_ADDITIONAL');--> statement-breakpoint
CREATE TYPE "public"."severance_decision" AS ENUM('pending', 'acquire_whole', 's28_damages', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."social_category" AS ENUM('GENERAL', 'OBC', 'SC', 'ST');--> statement-breakpoint
CREATE TYPE "public"."stage_status" AS ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'APPROVED', 'NULLIFIED', 'SKIPPED', 'TERMINATED');--> statement-breakpoint
CREATE TYPE "public"."survey_type" AS ENUM('PARCEL_IDENTIFICATION', 'JOINT_INSPECTION');--> statement-breakpoint
CREATE TYPE "public"."transition_action" AS ENUM('SUBMIT', 'APPROVE', 'APPROVE_CONDITIONAL', 'RETURN', 'REJECT', 'NULLIFY', 'OVERRIDE', 'TERMINATE', 'SKIP');--> statement-breakpoint
CREATE TYPE "public"."utilisation_status" AS ENUM('pending', 'utilised', 'unutilised');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."vertex_capture_method" AS ENUM('GPS_WALKED', 'MAP_DRAWN');--> statement-breakpoint
CREATE TABLE "districts" (
	"code" text PRIMARY KEY NOT NULL,
	"state_code" text NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "states" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sub_districts" (
	"code" text PRIMARY KEY NOT NULL,
	"district_code" text NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "villages" (
	"code" text PRIMARY KEY NOT NULL,
	"sub_district_code" text NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"boundary" geometry(MultiPolygon,4326),
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "post_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"designation" text NOT NULL,
	"role" "role" NOT NULL,
	"jurisdiction_level" "jurisdiction_level" NOT NULL,
	"state_code" text,
	"district_code" text,
	"project_id" uuid,
	"requiring_body_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "posts_scope_complete" CHECK ("posts"."jurisdiction_level" = 'NATIONAL'
        OR ("posts"."jurisdiction_level" = 'STATE' AND "posts"."state_code" IS NOT NULL)
        OR ("posts"."jurisdiction_level" = 'DISTRICT' AND "posts"."district_code" IS NOT NULL)
        OR ("posts"."jurisdiction_level" = 'PROJECT' AND ("posts"."project_id" IS NOT NULL OR "posts"."requiring_body_id" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"active_post_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"replaced_by" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "refresh_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "requiring_bodies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"short_code" text NOT NULL,
	"type" "requiring_body_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "requiring_bodies_shortCode_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone_masked" text,
	"password_hash" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "project_districts" (
	"project_id" uuid NOT NULL,
	"district_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "project_districts_project_id_district_code_pk" PRIMARY KEY("project_id","district_code")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_local" text,
	"category" "project_category" NOT NULL,
	"sub_category" text,
	"acquisition_type" "acquisition_type" NOT NULL,
	"requiring_body_id" uuid NOT NULL,
	"national_importance" boolean DEFAULT false NOT NULL,
	"estimated_budget_paise" bigint,
	"rule_pack_code" text,
	"rule_pack_version" text,
	"appropriate_govt" "appropriate_govt" DEFAULT 'state' NOT NULL,
	"state_code" text NOT NULL,
	"is_linear" boolean DEFAULT false NOT NULL,
	"alignment" geometry(LineString,4326),
	"row_width_m" numeric(8, 2),
	"footprint" geometry(MultiPolygon,4326),
	"total_area_proposed_sqm" numeric(14, 2),
	"is_urgency" boolean DEFAULT false NOT NULL,
	"in_scheduled_area" boolean DEFAULT false NOT NULL,
	"status" "project_status" DEFAULT 'DRAFT' NOT NULL,
	"current_stage" text,
	"submitted_at" timestamp with time zone,
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "projects_code_unique" UNIQUE("code"),
	CONSTRAINT "projects_pack_pair" CHECK (("projects"."rule_pack_code" IS NULL) = ("projects"."rule_pack_version" IS NULL)),
	CONSTRAINT "projects_pack_pinned" CHECK ("projects"."status" = 'DRAFT' OR "projects"."rule_pack_code" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "rule_packs" (
	"code" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"governing_act" text NOT NULL,
	"jurisdiction_level" "jurisdiction_level" NOT NULL,
	"state_code" text,
	"extends_code" text,
	"extends_version" text,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"definition" jsonb NOT NULL,
	"checksum" text NOT NULL,
	"loaded_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "rule_packs_code_version_pk" PRIMARY KEY("code","version")
);
--> statement-breakpoint
CREATE TABLE "expert_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"outcome" "expert_outcome" NOT NULL,
	"conditions" text,
	"members" jsonb NOT NULL,
	"chairperson" text,
	"dissent_notes" jsonb,
	"report_document_id" uuid,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "government_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"expert_recommendation_id" uuid NOT NULL,
	"written_reasons" text NOT NULL,
	"order_document_id" uuid,
	"decided_by_post_id" uuid NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "overrides_reasons_present" CHECK (length(trim("government_overrides"."written_reasons")) > 0)
);
--> statement-breakpoint
CREATE TABLE "hearings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" "hearing_type" NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"venue" text,
	"village_code" text,
	"notice_published_at" timestamp with time zone,
	"notice_document_id" uuid,
	"local_language_summary_document_id" uuid,
	"recording_document_id" uuid,
	"attendance_document_id" uuid,
	"quorum_met" boolean,
	"response_matrix_document_id" uuid,
	"status" "hearing_status" DEFAULT 'SCHEDULED' NOT NULL,
	"void_reason_code" text,
	"voided_by_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "stage_checklist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_instance_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"item_type" "checklist_item_type" NOT NULL,
	"satisfied" boolean DEFAULT false NOT NULL,
	"satisfied_at" timestamp with time zone,
	"ref_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "stage_checklist_stageInstanceId_itemCode_unique" UNIQUE("stage_instance_id","item_code")
);
--> statement-breakpoint
CREATE TABLE "stage_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_code" text NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" "stage_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"assigned_post_id" uuid,
	"submitted_by_user_id" uuid,
	"submitted_by_post_id" uuid,
	"outcome" jsonb,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "stage_instances_projectId_stageCode_attempt_unique" UNIQUE("project_id","stage_code","attempt")
);
--> statement-breakpoint
CREATE TABLE "stage_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_instance_id" uuid NOT NULL,
	"from_status" "stage_status",
	"to_status" "stage_status" NOT NULL,
	"action" "transition_action" NOT NULL,
	"target_stage_code" text,
	"reason_code" text,
	"remarks" text,
	"actor_user_id" uuid NOT NULL,
	"actor_post_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"document_ids" uuid[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "statutory_deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"clock_code" text NOT NULL,
	"section" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"rule_pack_code" text NOT NULL,
	"rule_pack_version" text NOT NULL,
	"start_event" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"consequence" text NOT NULL,
	"status" "deadline_status" DEFAULT 'NOT_STARTED' NOT NULL,
	"satisfied_at" timestamp with time zone,
	"breached_at" timestamp with time zone,
	"condition_inputs" jsonb,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "boundary_pillars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"pillar_no" integer NOT NULL,
	"point" geometry(Point,4326) NOT NULL,
	"photo_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "boundary_pillars_parcelId_pillarNo_unique" UNIQUE("parcel_id","pillar_no")
);
--> statement-breakpoint
CREATE TABLE "common_property_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"village_code" text NOT NULL,
	"cpr_type" "cpr_type" NOT NULL,
	"name" text NOT NULL,
	"point" geometry(Point,4326),
	"affected" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "constraint_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_type" "constraint_layer" NOT NULL,
	"name" text NOT NULL,
	"geom" geometry(MultiPolygon,4326) NOT NULL,
	"source" text,
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "field_surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parcel_id" uuid,
	"survey_type" "survey_type" NOT NULL,
	"surveyor_user_id" uuid NOT NULL,
	"surveyor_post_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"device_info" jsonb,
	"track" geometry(LineString,4326),
	"notice_served_on" date,
	"notice_document_id" uuid,
	"status" "field_survey_status" DEFAULT 'draft' NOT NULL,
	"verified_by_post_id" uuid,
	"verification_remarks" text,
	"override_reason" text,
	"plausibility" jsonb,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "jir_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"item_type" "jir_item_type" NOT NULL,
	"description" text,
	"quantity" numeric(12, 2),
	"unit" text,
	"photo_document_id" uuid,
	"point" geometry(Point,4326),
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "land_parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"village_code" text NOT NULL,
	"survey_number" text NOT NULL,
	"sub_division" text,
	"geom" geometry(MultiPolygon,4326) NOT NULL,
	"recorded_area_sqm" numeric(14, 2),
	"field_area_sqm" numeric(14, 2),
	"area_diff_pct" numeric(9, 2) GENERATED ALWAYS AS (CASE WHEN recorded_area_sqm > 0 AND field_area_sqm IS NOT NULL
               THEN round((field_area_sqm - recorded_area_sqm) / recorded_area_sqm * 100, 2) END) STORED,
	"boundary_source" "boundary_source" NOT NULL,
	"land_class" "land_class" NOT NULL,
	"is_irrigated_multicrop" boolean DEFAULT false NOT NULL,
	"in_scheduled_area" boolean DEFAULT false NOT NULL,
	"transfer_frozen_at" timestamp with time zone,
	"geom_hash" text,
	"version" integer DEFAULT 1 NOT NULL,
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "parcel_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer,
	"reason" text NOT NULL,
	"requested_by_post_id" uuid NOT NULL,
	"approved_by_post_id" uuid,
	"status" "correction_status" DEFAULT 'requested' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "parcel_vertices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"parcel_id" uuid,
	"seq" integer NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"accuracy_m" numeric(8, 2),
	"capture_method" "vertex_capture_method" NOT NULL,
	"samples_averaged" integer,
	"photo_document_id" uuid,
	"captured_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "parcel_vertices_surveyId_seq_unique" UNIQUE("survey_id","seq")
);
--> statement-breakpoint
CREATE TABLE "project_parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parcel_id" uuid NOT NULL,
	"affected_geom" geometry(MultiPolygon,4326),
	"affected_area_sqm" numeric(14, 2),
	"affected_pct" numeric(5, 2),
	"chainage_km" numeric(9, 3),
	"status" "parcel_status" DEFAULT 'PROPOSED' NOT NULL,
	"flags" "parcel_flag"[] DEFAULT '{}' NOT NULL,
	"severance_claimed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "project_parcels_projectId_parcelId_unique" UNIQUE("project_id","parcel_id")
);
--> statement-breakpoint
CREATE TABLE "spatial_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"project_parcel_id" uuid,
	"layer_type" "constraint_layer",
	"flag_type" text NOT NULL,
	"overlap_area_sqm" numeric(14, 2),
	"message" text NOT NULL,
	"raised_at" timestamp with time zone NOT NULL,
	"acknowledged_by_post_id" uuid,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "affected_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"head_person_id" uuid NOT NULL,
	"affected_type" "affected_type" NOT NULL,
	"is_displaced" boolean DEFAULT false NOT NULL,
	"is_multiple_displacement" boolean DEFAULT false NOT NULL,
	"family_size" integer,
	"is_sc_st" boolean DEFAULT false NOT NULL,
	"is_female_headed" boolean DEFAULT false NOT NULL,
	"is_destitute" boolean DEFAULT false NOT NULL,
	"has_disability" boolean DEFAULT false NOT NULL,
	"relocated_outside_district" boolean DEFAULT false NOT NULL,
	"authorised_recipient_person_id" uuid NOT NULL,
	"joint_recipient_person_id" uuid,
	"resettlement_site_id" uuid,
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "affected_families_projectId_headPersonId_unique" UNIQUE("project_id","head_person_id")
);
--> statement-breakpoint
CREATE TABLE "family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affected_family_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "parcel_interests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"interest_type" "interest_type" NOT NULL,
	"share_fraction" numeric(7, 6),
	"evidence_document_id" uuid,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"verified_by_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"full_name_local" text,
	"guardian_name" text,
	"gender" text,
	"social_category" "social_category" NOT NULL,
	"village_code" text NOT NULL,
	"phone_masked" text,
	"phone_enc" "bytea",
	"bank_ref_masked" text,
	"bank_ref_enc" "bytea",
	"is_deceased" boolean DEFAULT false NOT NULL,
	"data_source" "data_source" NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rnr_census_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"affected_family_id" uuid NOT NULL,
	"categorisation" "affected_type" NOT NULL,
	"vulnerability" jsonb,
	"administrator_post_id" uuid,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sia_census_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"village_code" text NOT NULL,
	"household_ref" text NOT NULL,
	"affected_family_id" uuid,
	"payload" jsonb NOT NULL,
	"enumerator_post_id" uuid,
	"captured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"parcel_id" uuid,
	"category" "claim_category" NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"amount_claimed_paise" bigint,
	"body" text NOT NULL,
	"status" "claim_status" DEFAULT 'filed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_entry_id" uuid NOT NULL,
	"decision" "consent_decision" NOT NULL,
	"form_document_id" uuid,
	"collected_by_post_id" uuid NOT NULL,
	"observer_post_id" uuid,
	"observer_certified" boolean DEFAULT false NOT NULL,
	"collected_at" timestamp with time zone NOT NULL,
	"point" geometry(Point,4326),
	"identity_check_ref" text,
	"identity_provider" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "consent_records_registerEntryId_unique" UNIQUE("register_entry_id")
);
--> statement-breakpoint
CREATE TABLE "consent_register_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"register_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"affected_family_id" uuid,
	"eligibility_basis" text NOT NULL,
	"is_heir_update" boolean DEFAULT false NOT NULL,
	"status" "consent_entry_status" DEFAULT 'eligible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "consent_register_entries_registerId_personId_unique" UNIQUE("register_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "consent_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"status" "consent_register_status" DEFAULT 'draft' NOT NULL,
	"display_from" date,
	"display_to" date,
	"certified_at" timestamp with time zone,
	"certified_by_post_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "objections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"person_id" uuid,
	"parcel_id" uuid,
	"channel" "objection_channel" NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"language" text,
	"body" text NOT NULL,
	"transcript_document_id" uuid,
	"statutory_ground" "objection_ground",
	"operational_category" "objection_category",
	"ai_suggested_ground" "objection_ground",
	"ai_suggested_category" "objection_category",
	"ai_confidence" numeric(4, 3),
	"status" "objection_status" DEFAULT 'FILED' NOT NULL,
	"hearing_id" uuid,
	"decision_remarks" text,
	"decided_by_post_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "access_token_purpose" NOT NULL,
	"person_id" uuid NOT NULL,
	"subject_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "access_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"disbursement_id" uuid NOT NULL,
	"method" "ack_method" NOT NULL,
	"webauthn_credential_id" text,
	"assertion_sha256" text,
	"otp_ref" text,
	"witness_post_id" uuid,
	"fallback_reason" text,
	"photo_document_id" uuid,
	"point" geometry(Point,4326),
	"confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "acknowledgements_disbursementId_unique" UNIQUE("disbursement_id")
);
--> statement-breakpoint
CREATE TABLE "annuity_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"instalment_no" integer NOT NULL,
	"due_on" date NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "annuity_status" DEFAULT 'scheduled' NOT NULL,
	"disbursement_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "annuity_schedules_entitlementId_instalmentNo_unique" UNIQUE("entitlement_id","instalment_no")
);
--> statement-breakpoint
CREATE TABLE "awards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"award_type" "award_type" NOT NULL,
	"award_no" text NOT NULL,
	"pronounced_at" timestamp with time zone,
	"collector_post_id" uuid,
	"lao_post_id" uuid,
	"document_id" uuid,
	"ocr_extraction_id" uuid,
	"status" "award_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "awards_projectId_awardNo_unique" UNIQUE("project_id","award_no")
);
--> statement-breakpoint
CREATE TABLE "disbursements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entitlement_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"instrument" "payment_instrument" NOT NULL,
	"initiated_at" timestamp with time zone NOT NULL,
	"paid_on" date,
	"payment_status" "payment_status" DEFAULT 'INITIATED' NOT NULL,
	"adapter_ref" text,
	"adapter_provider" text,
	"is_first_instalment" boolean DEFAULT false NOT NULL,
	"acceptance_type" "acceptance_type",
	"indemnity_bond_document_id" uuid,
	"hold_reason" text,
	"hold_reason_code" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "disbursements_amount_positive" CHECK ("disbursements"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affected_family_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"schedule_ref" "schedule_ref" NOT NULL,
	"head_code" text NOT NULL,
	"amount_awarded_paise" bigint NOT NULL,
	"source" "entitlement_source" NOT NULL,
	"due_by" timestamp with time zone,
	"status" "entitlement_status" DEFAULT 'ASSESSED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "entitlements_amount_nonnegative" CHECK ("entitlements"."amount_awarded_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "escrow_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"gate" "escrow_gate" NOT NULL,
	"demand_amount_paise" bigint NOT NULL,
	"demand_document_id" uuid,
	"deposited_amount_paise" bigint DEFAULT 0 NOT NULL,
	"sufficiency_certified_at" timestamp with time zone,
	"certified_by_post_id" uuid,
	"status" "escrow_status" DEFAULT 'demanded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "escrow_accounts_projectId_gate_unique" UNIQUE("project_id","gate")
);
--> statement-breakpoint
CREATE TABLE "escrow_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_account_id" uuid NOT NULL,
	"kind" "escrow_txn_kind" NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reference" text,
	"at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "webauthn_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" "bytea" NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_label" text,
	"enrolled_at" timestamp with time zone NOT NULL,
	"enrolled_witness_post_id" uuid,
	"enrolment_point" geometry(Point,4326),
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "webauthn_credentials_credentialId_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "amenity_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"amenity_code" text NOT NULL,
	"status" "amenity_status" DEFAULT 'planned' NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "amenity_milestones_siteId_amenityCode_unique" UNIQUE("site_id","amenity_code")
);
--> statement-breakpoint
CREATE TABLE "resettlement_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"geom" geometry(MultiPolygon,4326),
	"capacity_families" integer,
	"layout_document_id" uuid,
	"commissioning_certificate_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rnr_passbooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affected_family_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload_sha256" text NOT NULL,
	"issued_at" timestamp with time zone NOT NULL,
	"public_token_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "rnr_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "rnr_scheme_status" DEFAULT 'draft' NOT NULL,
	"draft_document_id" uuid,
	"approved_by_post_id" uuid,
	"approved_at" timestamp with time zone,
	"gazette_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "legal_case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"notes" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "legal_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parcel_id" uuid,
	"person_id" uuid,
	"case_type" "legal_case_type" NOT NULL,
	"case_no" text,
	"filed_at" timestamp with time zone NOT NULL,
	"status" "legal_case_status" DEFAULT 'filed' NOT NULL,
	"next_hearing_at" timestamp with time zone,
	"differential_liability_paise" bigint,
	"order_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "monitoring_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"committee" "monitoring_committee" NOT NULL,
	"period" text NOT NULL,
	"report_document_id" uuid,
	"findings" jsonb,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "mutations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parcel_id" uuid NOT NULL,
	"direction" "mutation_direction" NOT NULL,
	"from_holder" text,
	"to_holder" text,
	"extract_document_id" uuid,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "possession_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_parcel_id" uuid NOT NULL,
	"vacation_certificate_document_id" uuid,
	"notice_document_id" uuid,
	"panchnama_document_id" uuid,
	"possession_certificate_document_id" uuid,
	"handover_document_id" uuid,
	"witnesses" jsonb,
	"point" geometry(Point,4326),
	"taken_at" timestamp with time zone NOT NULL,
	"taken_by_post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "possession_events_projectParcelId_unique" UNIQUE("project_parcel_id")
);
--> statement-breakpoint
CREATE TABLE "severance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_parcel_id" uuid NOT NULL,
	"filed_at" timestamp with time zone NOT NULL,
	"inspection_document_id" uuid,
	"decision" "severance_decision" DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "utilisation_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_parcel_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "utilisation_status" DEFAULT 'pending' NOT NULL,
	"finding" text,
	"reversion" "reversion",
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "value_sharing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_parcel_id" uuid NOT NULL,
	"transfer_date" date NOT NULL,
	"consideration_paise" bigint NOT NULL,
	"appreciated_value_paise" bigint NOT NULL,
	"share_paise" bigint,
	"confirmed_by_post_id" uuid,
	"distributed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"designation_snapshot" text NOT NULL,
	"jurisdiction_snapshot" text NOT NULL,
	"declaration_version" text NOT NULL,
	"document_sha256" text NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"attested_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "attestations_documentId_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"actor_user_id" uuid,
	"actor_post_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"ip" "inet",
	"request_id" text,
	"prev_hash" text DEFAULT '' NOT NULL,
	"hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "chain_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"entity_version" integer DEFAULT 1 NOT NULL,
	"event_type" text NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"data_hash" text NOT NULL,
	"status" "chain_status" DEFAULT 'QUEUED' NOT NULL,
	"tx_hash" text,
	"block_number" bigint,
	"anchored_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid,
	CONSTRAINT "chain_events_entityType_entityId_entityVersion_unique" UNIQUE("entity_type","entity_id","entity_version")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"doc_type" "doc_type" NOT NULL,
	"title" text NOT NULL,
	"language" text,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_id" uuid,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_by_post_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_post_id" uuid NOT NULL,
	"recipient_user_id" uuid,
	"trigger" text NOT NULL,
	"severity" "notification_severity" DEFAULT 'info' NOT NULL,
	"escalation_level" integer DEFAULT 0 NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"title" text NOT NULL,
	"body" text,
	"deep_link" text,
	"channels" jsonb DEFAULT '{}' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ocr_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"engine" text NOT NULL,
	"fields" jsonb DEFAULT '[]' NOT NULL,
	"status" "ocr_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by_post_id" uuid,
	"accepted" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now(),
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "districts" ADD CONSTRAINT "districts_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_districts" ADD CONSTRAINT "sub_districts_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "villages" ADD CONSTRAINT "villages_sub_district_code_sub_districts_code_fk" FOREIGN KEY ("sub_district_code") REFERENCES "public"."sub_districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assignments" ADD CONSTRAINT "post_assignments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_assignments" ADD CONSTRAINT "post_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_requiring_body_id_requiring_bodies_id_fk" FOREIGN KEY ("requiring_body_id") REFERENCES "public"."requiring_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_active_post_id_posts_id_fk" FOREIGN KEY ("active_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_districts" ADD CONSTRAINT "project_districts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_districts" ADD CONSTRAINT "project_districts_district_code_districts_code_fk" FOREIGN KEY ("district_code") REFERENCES "public"."districts"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_requiring_body_id_requiring_bodies_id_fk" FOREIGN KEY ("requiring_body_id") REFERENCES "public"."requiring_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_state_code_states_code_fk" FOREIGN KEY ("state_code") REFERENCES "public"."states"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_rule_pack_code_rule_pack_version_rule_packs_code_version_fk" FOREIGN KEY ("rule_pack_code","rule_pack_version") REFERENCES "public"."rule_packs"("code","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_recommendations" ADD CONSTRAINT "expert_recommendations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_recommendations" ADD CONSTRAINT "expert_recommendations_report_document_id_documents_id_fk" FOREIGN KEY ("report_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_overrides" ADD CONSTRAINT "government_overrides_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_overrides" ADD CONSTRAINT "government_overrides_expert_recommendation_id_expert_recommendations_id_fk" FOREIGN KEY ("expert_recommendation_id") REFERENCES "public"."expert_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_overrides" ADD CONSTRAINT "government_overrides_order_document_id_documents_id_fk" FOREIGN KEY ("order_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_overrides" ADD CONSTRAINT "government_overrides_decided_by_post_id_posts_id_fk" FOREIGN KEY ("decided_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_village_code_villages_code_fk" FOREIGN KEY ("village_code") REFERENCES "public"."villages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_notice_document_id_documents_id_fk" FOREIGN KEY ("notice_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_local_language_summary_document_id_documents_id_fk" FOREIGN KEY ("local_language_summary_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_recording_document_id_documents_id_fk" FOREIGN KEY ("recording_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_attendance_document_id_documents_id_fk" FOREIGN KEY ("attendance_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_response_matrix_document_id_documents_id_fk" FOREIGN KEY ("response_matrix_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hearings" ADD CONSTRAINT "hearings_voided_by_post_id_posts_id_fk" FOREIGN KEY ("voided_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_checklist" ADD CONSTRAINT "stage_checklist_stage_instance_id_stage_instances_id_fk" FOREIGN KEY ("stage_instance_id") REFERENCES "public"."stage_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_assigned_post_id_posts_id_fk" FOREIGN KEY ("assigned_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_instances" ADD CONSTRAINT "stage_instances_submitted_by_post_id_posts_id_fk" FOREIGN KEY ("submitted_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_stage_instance_id_stage_instances_id_fk" FOREIGN KEY ("stage_instance_id") REFERENCES "public"."stage_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_transitions" ADD CONSTRAINT "stage_transitions_actor_post_id_posts_id_fk" FOREIGN KEY ("actor_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statutory_deadlines" ADD CONSTRAINT "statutory_deadlines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundary_pillars" ADD CONSTRAINT "boundary_pillars_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boundary_pillars" ADD CONSTRAINT "boundary_pillars_photo_document_id_documents_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_property_resources" ADD CONSTRAINT "common_property_resources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "common_property_resources" ADD CONSTRAINT "common_property_resources_village_code_villages_code_fk" FOREIGN KEY ("village_code") REFERENCES "public"."villages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_surveyor_user_id_users_id_fk" FOREIGN KEY ("surveyor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_surveyor_post_id_posts_id_fk" FOREIGN KEY ("surveyor_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_notice_document_id_documents_id_fk" FOREIGN KEY ("notice_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_surveys" ADD CONSTRAINT "field_surveys_verified_by_post_id_posts_id_fk" FOREIGN KEY ("verified_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jir_items" ADD CONSTRAINT "jir_items_survey_id_field_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."field_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jir_items" ADD CONSTRAINT "jir_items_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jir_items" ADD CONSTRAINT "jir_items_photo_document_id_documents_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "land_parcels" ADD CONSTRAINT "land_parcels_village_code_villages_code_fk" FOREIGN KEY ("village_code") REFERENCES "public"."villages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_corrections" ADD CONSTRAINT "parcel_corrections_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_corrections" ADD CONSTRAINT "parcel_corrections_requested_by_post_id_posts_id_fk" FOREIGN KEY ("requested_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_corrections" ADD CONSTRAINT "parcel_corrections_approved_by_post_id_posts_id_fk" FOREIGN KEY ("approved_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_vertices" ADD CONSTRAINT "parcel_vertices_survey_id_field_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."field_surveys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_vertices" ADD CONSTRAINT "parcel_vertices_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_vertices" ADD CONSTRAINT "parcel_vertices_photo_document_id_documents_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_parcels" ADD CONSTRAINT "project_parcels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_parcels" ADD CONSTRAINT "project_parcels_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spatial_flags" ADD CONSTRAINT "spatial_flags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spatial_flags" ADD CONSTRAINT "spatial_flags_project_parcel_id_project_parcels_id_fk" FOREIGN KEY ("project_parcel_id") REFERENCES "public"."project_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spatial_flags" ADD CONSTRAINT "spatial_flags_acknowledged_by_post_id_posts_id_fk" FOREIGN KEY ("acknowledged_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affected_families" ADD CONSTRAINT "affected_families_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affected_families" ADD CONSTRAINT "affected_families_head_person_id_persons_id_fk" FOREIGN KEY ("head_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affected_families" ADD CONSTRAINT "affected_families_authorised_recipient_person_id_persons_id_fk" FOREIGN KEY ("authorised_recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affected_families" ADD CONSTRAINT "affected_families_joint_recipient_person_id_persons_id_fk" FOREIGN KEY ("joint_recipient_person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affected_families" ADD CONSTRAINT "affected_families_resettlement_site_id_resettlement_sites_id_fk" FOREIGN KEY ("resettlement_site_id") REFERENCES "public"."resettlement_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_interests" ADD CONSTRAINT "parcel_interests_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_interests" ADD CONSTRAINT "parcel_interests_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_interests" ADD CONSTRAINT "parcel_interests_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcel_interests" ADD CONSTRAINT "parcel_interests_verified_by_post_id_posts_id_fk" FOREIGN KEY ("verified_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_village_code_villages_code_fk" FOREIGN KEY ("village_code") REFERENCES "public"."villages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_census_records" ADD CONSTRAINT "rnr_census_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_census_records" ADD CONSTRAINT "rnr_census_records_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_census_records" ADD CONSTRAINT "rnr_census_records_administrator_post_id_posts_id_fk" FOREIGN KEY ("administrator_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sia_census_records" ADD CONSTRAINT "sia_census_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sia_census_records" ADD CONSTRAINT "sia_census_records_village_code_villages_code_fk" FOREIGN KEY ("village_code") REFERENCES "public"."villages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sia_census_records" ADD CONSTRAINT "sia_census_records_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sia_census_records" ADD CONSTRAINT "sia_census_records_enumerator_post_id_posts_id_fk" FOREIGN KEY ("enumerator_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_register_entry_id_consent_register_entries_id_fk" FOREIGN KEY ("register_entry_id") REFERENCES "public"."consent_register_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_form_document_id_documents_id_fk" FOREIGN KEY ("form_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_collected_by_post_id_posts_id_fk" FOREIGN KEY ("collected_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_observer_post_id_posts_id_fk" FOREIGN KEY ("observer_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_register_entries" ADD CONSTRAINT "consent_register_entries_register_id_consent_registers_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."consent_registers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_register_entries" ADD CONSTRAINT "consent_register_entries_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_register_entries" ADD CONSTRAINT "consent_register_entries_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_registers" ADD CONSTRAINT "consent_registers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_registers" ADD CONSTRAINT "consent_registers_certified_by_post_id_posts_id_fk" FOREIGN KEY ("certified_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_transcript_document_id_documents_id_fk" FOREIGN KEY ("transcript_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_hearing_id_hearings_id_fk" FOREIGN KEY ("hearing_id") REFERENCES "public"."hearings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objections" ADD CONSTRAINT "objections_decided_by_post_id_posts_id_fk" FOREIGN KEY ("decided_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_disbursement_id_disbursements_id_fk" FOREIGN KEY ("disbursement_id") REFERENCES "public"."disbursements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_witness_post_id_posts_id_fk" FOREIGN KEY ("witness_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acknowledgements" ADD CONSTRAINT "acknowledgements_photo_document_id_documents_id_fk" FOREIGN KEY ("photo_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annuity_schedules" ADD CONSTRAINT "annuity_schedules_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annuity_schedules" ADD CONSTRAINT "annuity_schedules_disbursement_id_disbursements_id_fk" FOREIGN KEY ("disbursement_id") REFERENCES "public"."disbursements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_collector_post_id_posts_id_fk" FOREIGN KEY ("collector_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_lao_post_id_posts_id_fk" FOREIGN KEY ("lao_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_ocr_extraction_id_ocr_extractions_id_fk" FOREIGN KEY ("ocr_extraction_id") REFERENCES "public"."ocr_extractions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_entitlement_id_entitlements_id_fk" FOREIGN KEY ("entitlement_id") REFERENCES "public"."entitlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_indemnity_bond_document_id_documents_id_fk" FOREIGN KEY ("indemnity_bond_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_award_id_awards_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."awards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_demand_document_id_documents_id_fk" FOREIGN KEY ("demand_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_accounts" ADD CONSTRAINT "escrow_accounts_certified_by_post_id_posts_id_fk" FOREIGN KEY ("certified_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escrow_transactions" ADD CONSTRAINT "escrow_transactions_escrow_account_id_escrow_accounts_id_fk" FOREIGN KEY ("escrow_account_id") REFERENCES "public"."escrow_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_enrolled_witness_post_id_posts_id_fk" FOREIGN KEY ("enrolled_witness_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_milestones" ADD CONSTRAINT "amenity_milestones_site_id_resettlement_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."resettlement_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amenity_milestones" ADD CONSTRAINT "amenity_milestones_evidence_document_id_documents_id_fk" FOREIGN KEY ("evidence_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resettlement_sites" ADD CONSTRAINT "resettlement_sites_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resettlement_sites" ADD CONSTRAINT "resettlement_sites_layout_document_id_documents_id_fk" FOREIGN KEY ("layout_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resettlement_sites" ADD CONSTRAINT "resettlement_sites_commissioning_certificate_document_id_documents_id_fk" FOREIGN KEY ("commissioning_certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_passbooks" ADD CONSTRAINT "rnr_passbooks_affected_family_id_affected_families_id_fk" FOREIGN KEY ("affected_family_id") REFERENCES "public"."affected_families"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_passbooks" ADD CONSTRAINT "rnr_passbooks_public_token_id_access_tokens_id_fk" FOREIGN KEY ("public_token_id") REFERENCES "public"."access_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_schemes" ADD CONSTRAINT "rnr_schemes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_schemes" ADD CONSTRAINT "rnr_schemes_draft_document_id_documents_id_fk" FOREIGN KEY ("draft_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_schemes" ADD CONSTRAINT "rnr_schemes_approved_by_post_id_posts_id_fk" FOREIGN KEY ("approved_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rnr_schemes" ADD CONSTRAINT "rnr_schemes_gazette_document_id_documents_id_fk" FOREIGN KEY ("gazette_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case_events" ADD CONSTRAINT "legal_case_events_case_id_legal_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."legal_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_case_events" ADD CONSTRAINT "legal_case_events_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legal_cases" ADD CONSTRAINT "legal_cases_order_document_id_documents_id_fk" FOREIGN KEY ("order_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_audits" ADD CONSTRAINT "monitoring_audits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitoring_audits" ADD CONSTRAINT "monitoring_audits_report_document_id_documents_id_fk" FOREIGN KEY ("report_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutations" ADD CONSTRAINT "mutations_parcel_id_land_parcels_id_fk" FOREIGN KEY ("parcel_id") REFERENCES "public"."land_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutations" ADD CONSTRAINT "mutations_extract_document_id_documents_id_fk" FOREIGN KEY ("extract_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_project_parcel_id_project_parcels_id_fk" FOREIGN KEY ("project_parcel_id") REFERENCES "public"."project_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_vacation_certificate_document_id_documents_id_fk" FOREIGN KEY ("vacation_certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_notice_document_id_documents_id_fk" FOREIGN KEY ("notice_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_panchnama_document_id_documents_id_fk" FOREIGN KEY ("panchnama_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_possession_certificate_document_id_documents_id_fk" FOREIGN KEY ("possession_certificate_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_handover_document_id_documents_id_fk" FOREIGN KEY ("handover_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "possession_events" ADD CONSTRAINT "possession_events_taken_by_post_id_posts_id_fk" FOREIGN KEY ("taken_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "severance_claims" ADD CONSTRAINT "severance_claims_project_parcel_id_project_parcels_id_fk" FOREIGN KEY ("project_parcel_id") REFERENCES "public"."project_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "severance_claims" ADD CONSTRAINT "severance_claims_inspection_document_id_documents_id_fk" FOREIGN KEY ("inspection_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utilisation_audits" ADD CONSTRAINT "utilisation_audits_project_parcel_id_project_parcels_id_fk" FOREIGN KEY ("project_parcel_id") REFERENCES "public"."project_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_sharing_events" ADD CONSTRAINT "value_sharing_events_project_parcel_id_project_parcels_id_fk" FOREIGN KEY ("project_parcel_id") REFERENCES "public"."project_parcels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_sharing_events" ADD CONSTRAINT "value_sharing_events_confirmed_by_post_id_posts_id_fk" FOREIGN KEY ("confirmed_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestations" ADD CONSTRAINT "attestations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersedes_id_documents_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_post_id_posts_id_fk" FOREIGN KEY ("uploaded_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_post_id_posts_id_fk" FOREIGN KEY ("recipient_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ocr_extractions" ADD CONSTRAINT "ocr_extractions_reviewed_by_post_id_posts_id_fk" FOREIGN KEY ("reviewed_by_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_assignments_user_id_index" ON "post_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "post_assignments_post_id_index" ON "post_assignments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "project_districts_district_code_index" ON "project_districts" USING btree ("district_code");--> statement-breakpoint
CREATE INDEX "projects_footprint_index" ON "projects" USING gist ("footprint");--> statement-breakpoint
CREATE INDEX "outbox_events_unprocessed_idx" ON "outbox_events" USING btree ("id") WHERE "outbox_events"."processed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "stage_transitions_project_id_at_index" ON "stage_transitions" USING btree ("project_id","at");--> statement-breakpoint
CREATE INDEX "statutory_deadlines_status_due_at_index" ON "statutory_deadlines" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "statutory_deadlines_project_id_index" ON "statutory_deadlines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "constraint_layers_geom_index" ON "constraint_layers" USING gist ("geom");--> statement-breakpoint
CREATE UNIQUE INDEX "land_parcels_survey_uidx" ON "land_parcels" USING btree ("village_code","survey_number",coalesce("sub_division", ''));--> statement-breakpoint
CREATE INDEX "land_parcels_geom_index" ON "land_parcels" USING gist ("geom");--> statement-breakpoint
CREATE INDEX "project_parcels_parcel_id_index" ON "project_parcels" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "parcel_interests_parcel_id_index" ON "parcel_interests" USING btree ("parcel_id");--> statement-breakpoint
CREATE INDEX "parcel_interests_person_id_index" ON "parcel_interests" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "persons_village_code_index" ON "persons" USING btree ("village_code");--> statement-breakpoint
CREATE INDEX "disbursements_entitlement_id_index" ON "disbursements" USING btree ("entitlement_id");--> statement-breakpoint
CREATE INDEX "entitlements_affected_family_id_index" ON "entitlements" USING btree ("affected_family_id");--> statement-breakpoint
CREATE INDEX "entitlements_award_id_index" ON "entitlements" USING btree ("award_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_entity_id_index" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "documents_entity_type_entity_id_index" ON "documents" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "documents_project_id_index" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_post_id_read_at_index" ON "notifications" USING btree ("recipient_post_id","read_at");