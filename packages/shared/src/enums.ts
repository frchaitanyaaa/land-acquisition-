// The single definition of every enum (CLAUDE.md §10.2). packages/db mirrors each one as a
// Postgres enum; nothing else may redeclare these values.
//
// Stage and clock codes are NOT here as enums: packs define their own (the NH Act pack uses
// NH_3A_INTENT …), so the DB stores them as text. LARR_STAGE_CODES lists the base pack's codes
// for convenience only.

export const ROLES = [
  'SUPER_ADMIN',
  'CENTRAL_VIEWER',
  'POLICY_MAKER',
  'STATE_REVENUE',
  'RNR_COMMISSIONER',
  'COLLECTOR',
  'LAO',
  'DISTRICT_STAFF',
  'RNR_ADMINISTRATOR',
  'TEHSILDAR',
  'DILR',
  'FIELD_OFFICER',
  'REQUIRING_BODY',
  'SIA_AGENCY',
  'EXPERT_GROUP_MEMBER',
  'DLSA_OBSERVER',
  'TREASURY_OFFICER',
  'LEGAL_CELL',
  'MONITORING_COMMITTEE',
] as const;
export type Role = (typeof ROLES)[number];

export const JURISDICTION_LEVELS = ['NATIONAL', 'STATE', 'DISTRICT', 'PROJECT'] as const;
export type JurisdictionLevel = (typeof JURISDICTION_LEVELS)[number];

export const ACQUISITION_TYPES = ['GOVERNMENT', 'PPP', 'PRIVATE'] as const;
export type AcquisitionType = (typeof ACQUISITION_TYPES)[number];

export const PROJECT_CATEGORIES = [
  'STRATEGIC_DEFENCE',
  'TRANSPORT',
  'ENERGY_UTILITIES',
  'WATER_AGRICULTURE',
  'INDUSTRIAL',
  'URBAN_HOUSING',
  'PUBLIC_SERVICES',
  'PPP_CORPORATE',
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const PROJECT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ACTIVE',
  'ON_HOLD',
  'TERMINATED',
  'DENOTIFIED',
  'ABANDONED',
  'LAPSED',
  'CLOSED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const LARR_STAGE_CODES = [
  'S01_PROPOSAL',
  'S02_SIA',
  'S03_APPRAISAL',
  'S04_CONSENT',
  'S05_NOTIFICATION',
  'S06_RNR_SCHEME',
  'S07_DECLARATION',
  'S08_AWARD',
  'S09_PAYMENT_POSSESSION',
  'S10_POST_ACQUISITION',
] as const;
export type LarrStageCode = (typeof LARR_STAGE_CODES)[number];

export const STAGE_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'RETURNED',
  'APPROVED',
  'NULLIFIED',
  'SKIPPED',
  'TERMINATED',
] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const TRANSITION_ACTIONS = [
  'SUBMIT',
  'APPROVE',
  'APPROVE_CONDITIONAL',
  'RETURN',
  'REJECT',
  'NULLIFY',
  'OVERRIDE',
  'TERMINATE',
  'SKIP',
] as const;
export type TransitionAction = (typeof TRANSITION_ACTIONS)[number];

export const PARCEL_STATUSES = [
  'PROPOSED',
  'VERIFICATION_PENDING',
  'VERIFIED',
  'CONSENT_ACQUIRED_NOTIFIED',
  'CLEARED_FOR_AWARD_RNR',
  'AWARDED',
  'READY_FOR_POSSESSION',
  'ACQUIRED_POSSESSED',
  'CLOSED',
  'DENOTIFIED',
  'TERMINATED',
] as const;
export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

/** Flags, not statuses: a parcel can carry several at once. */
export const PARCEL_FLAGS = [
  'DISPUTED',
  'DELAYED',
  'AREA_MISMATCH',
  'OVERLAP',
  'OUTSIDE_VILLAGE',
  'CONSTRAINT_HIT',
] as const;
export type ParcelFlag = (typeof PARCEL_FLAGS)[number];

export const BOUNDARY_SOURCES = ['CADASTRAL_IMPORT', 'FIELD_DRAWN', 'SURVEY_REFERENCE_ONLY'] as const;
export type BoundarySource = (typeof BOUNDARY_SOURCES)[number];

export const VERTEX_CAPTURE_METHODS = ['GPS_WALKED', 'MAP_DRAWN'] as const;
export type VertexCaptureMethod = (typeof VERTEX_CAPTURE_METHODS)[number];

export const LAND_CLASSES = [
  'IRRIGATED_MULTICROP',
  'AGRICULTURAL',
  'UNIRRIGATED',
  'NON_AGRI_COMMERCIAL',
  'RESIDENTIAL',
  'GOVT_WASTE',
  'FOREST',
] as const;
export type LandClass = (typeof LAND_CLASSES)[number];

export const INTEREST_TYPES = [
  'OWNER',
  'TENANT',
  'SHARECROPPER',
  'LABOURER',
  'FOREST_RIGHT_HOLDER',
  'EASEMENT',
  'MORTGAGEE',
] as const;
export type InterestType = (typeof INTEREST_TYPES)[number];

export const AFFECTED_TYPES = [
  'LAND_LOSER',
  'LIVELIHOOD_DEPENDENT',
  'FOREST_DWELLER',
  'HOMESTEAD_LOSER',
  'URBAN_LIVELIHOOD',
] as const;
export type AffectedType = (typeof AFFECTED_TYPES)[number];

export const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST'] as const;
export type SocialCategory = (typeof SOCIAL_CATEGORIES)[number];

export const SURVEY_TYPES = ['PARCEL_IDENTIFICATION', 'JOINT_INSPECTION'] as const;
export type SurveyType = (typeof SURVEY_TYPES)[number];

export const JIR_ITEM_TYPES = ['TREE', 'CROP', 'WELL', 'BOREWELL', 'IRRIGATION_PIPE', 'STRUCTURE', 'OTHER'] as const;
export type JirItemType = (typeof JIR_ITEM_TYPES)[number];

export const CONSTRAINT_LAYERS = [
  'PROTECTED_FOREST',
  'ECO_SENSITIVE',
  'WATER_BODY',
  'SCHEDULED_AREA',
  'IRRIGATED_MULTICROP',
] as const;
export type ConstraintLayer = (typeof CONSTRAINT_LAYERS)[number];

export const HEARING_TYPES = ['SIA_PUBLIC', 'GRAM_SABHA_CONSENT', 'RNR_PUBLIC', 'S15_OBJECTION'] as const;
export type HearingType = (typeof HEARING_TYPES)[number];

export const HEARING_STATUSES = ['SCHEDULED', 'HELD', 'VALID', 'VOID'] as const;
export type HearingStatus = (typeof HEARING_STATUSES)[number];

export const EXPERT_OUTCOMES = ['A_UNCONDITIONAL', 'B_CONDITIONAL', 'C_REJECTION'] as const;
export type ExpertOutcome = (typeof EXPERT_OUTCOMES)[number];

export const CONSENT_TYPES = ['PRIVATE_80', 'PPP_70', 'GRAM_SABHA_S41'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_DECISIONS = ['CONSENT', 'REFUSE'] as const;
export type ConsentDecision = (typeof CONSENT_DECISIONS)[number];

/** Statutory grounds (s.15). */
export const OBJECTION_GROUNDS = ['AREA_SUITABILITY', 'PUBLIC_PURPOSE', 'SIA_FINDINGS'] as const;
export type ObjectionGround = (typeof OBJECTION_GROUNDS)[number];

/** Operational routing tag. */
export const OBJECTION_CATEGORIES = ['A_PUBLIC_PURPOSE', 'B_ALIGNMENT_SHIFT', 'C_SURVEY_ERROR'] as const;
export type ObjectionCategory = (typeof OBJECTION_CATEGORIES)[number];

export const OBJECTION_STATUSES = ['FILED', 'SCHEDULED', 'HEARD', 'UPHELD', 'REJECTED'] as const;
export type ObjectionStatus = (typeof OBJECTION_STATUSES)[number];

export const CLAIM_CATEGORIES = ['LAND_VALUATION', 'STRUCTURE_ASSET', 'RNR_ENTITLEMENT'] as const;
export type ClaimCategory = (typeof CLAIM_CATEGORIES)[number];

export const ESCROW_GATES = ['INITIAL', 'FULL'] as const;
export type EscrowGate = (typeof ESCROW_GATES)[number];

export const AWARD_TYPES = ['LAND', 'RNR'] as const;
export type AwardType = (typeof AWARD_TYPES)[number];

export const SCHEDULE_REFS = ['FIRST', 'SECOND', 'SC_ST_ADDITIONAL'] as const;
export type ScheduleRef = (typeof SCHEDULE_REFS)[number];

export const ENTITLEMENT_STATUSES = [
  'ASSESSED',
  'SANCTIONED',
  'DISBURSED',
  'ACKNOWLEDGED',
  'DEPOSITED_WITH_AUTHORITY',
  'DISPUTED',
  'UNDER_PROTEST',
] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const PAYMENT_INSTRUMENTS = ['DBT', 'DEPOSIT_WITH_AUTHORITY'] as const;
export type PaymentInstrument = (typeof PAYMENT_INSTRUMENTS)[number];

export const PAYMENT_STATUSES = ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ACCEPTANCE_TYPES = ['ABSOLUTE', 'UNDER_PROTEST'] as const;
export type AcceptanceType = (typeof ACCEPTANCE_TYPES)[number];

export const ACK_METHODS = ['WEBAUTHN', 'OTP', 'OFFICER_ATTESTED'] as const;
export type AckMethod = (typeof ACK_METHODS)[number];

export const DEADLINE_STATUSES = [
  'NOT_STARTED',
  'SAFE',
  'DUE_SOON',
  'BREACHED',
  'SATISFIED',
  'WAIVED',
  'VOIDED',
] as const;
export type DeadlineStatus = (typeof DEADLINE_STATUSES)[number];

export const CHAIN_STATUSES = ['QUEUED', 'SUBMITTED', 'ANCHORED', 'FAILED'] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export const VERIFY_RESULTS = ['VERIFIED', 'MISMATCH', 'PENDING', 'NOT_ANCHORED'] as const;
export type VerifyResult = (typeof VERIFY_RESULTS)[number];

export const LEGAL_CASE_TYPES = ['S64_REFERENCE', 'S73_REDETERMINATION', 'S74_APPEAL', 'WRIT'] as const;
export type LegalCaseType = (typeof LEGAL_CASE_TYPES)[number];

export const DATA_SOURCES = ['SYNTHETIC_DEMO', 'IMPORTED', 'FIELD_CAPTURED'] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

// ---------------------------------------------------------------------------------------------
// Small enums that §10.3 declares inline on a column, e.g. `type (central|state|psu|private|ppp)`.
// Values stay lowercase exactly as written there.

export const REQUIRING_BODY_TYPES = ['central', 'state', 'psu', 'private', 'ppp'] as const;
export type RequiringBodyType = (typeof REQUIRING_BODY_TYPES)[number];

export const APPROPRIATE_GOVTS = ['state', 'central'] as const;
export type AppropriateGovt = (typeof APPROPRIATE_GOVTS)[number];

export const CHECKLIST_ITEM_TYPES = ['document', 'event', 'gate', 'hearing'] as const;
export type ChecklistItemType = (typeof CHECKLIST_ITEM_TYPES)[number];

export const FIELD_SURVEY_STATUSES = ['draft', 'submitted', 'verified', 'returned'] as const;
export type FieldSurveyStatus = (typeof FIELD_SURVEY_STATUSES)[number];

export const VERIFICATION_STATUSES = ['pending', 'verified', 'disputed'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const CPR_TYPES = ['well', 'grazing', 'worship', 'school', 'clinic', 'cremation', 'pond', 'other'] as const;
export type CprType = (typeof CPR_TYPES)[number];

export const CORRECTION_STATUSES = ['requested', 'approved', 'rejected'] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

export const CONSENT_REGISTER_STATUSES = ['draft', 'displayed', 'certified'] as const;
export type ConsentRegisterStatus = (typeof CONSENT_REGISTER_STATUSES)[number];

export const CONSENT_ENTRY_STATUSES = ['eligible', 'removed'] as const;
export type ConsentEntryStatus = (typeof CONSENT_ENTRY_STATUSES)[number];

export const OBJECTION_CHANNELS = ['portal', 'helpdesk', 'hearing_audio'] as const;
export type ObjectionChannel = (typeof OBJECTION_CHANNELS)[number];

export const CLAIM_STATUSES = ['filed', 'accepted', 'defect_memo', 'decided'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const ESCROW_STATUSES = ['demanded', 'partially_funded', 'funded', 'certified'] as const;
export type EscrowStatus = (typeof ESCROW_STATUSES)[number];

export const ESCROW_TXN_KINDS = ['deposit', 'withdrawal', 'refund'] as const;
export type EscrowTxnKind = (typeof ESCROW_TXN_KINDS)[number];

export const AWARD_STATUSES = ['draft', 'signed'] as const;
export type AwardStatus = (typeof AWARD_STATUSES)[number];

export const ENTITLEMENT_SOURCES = ['manual', 'ocr_confirmed'] as const;
export type EntitlementSource = (typeof ENTITLEMENT_SOURCES)[number];

export const OCR_STATUSES = ['pending', 'ready', 'reviewed'] as const;
export type OcrStatus = (typeof OCR_STATUSES)[number];

export const RNR_SCHEME_STATUSES = ['draft', 'hearing', 'committee', 'approved', 'published'] as const;
export type RnrSchemeStatus = (typeof RNR_SCHEME_STATUSES)[number];

export const AMENITY_STATUSES = ['planned', 'in_progress', 'complete'] as const;
export type AmenityStatus = (typeof AMENITY_STATUSES)[number];

export const ANNUITY_STATUSES = ['scheduled', 'paid', 'missed'] as const;
export type AnnuityStatus = (typeof ANNUITY_STATUSES)[number];

export const ACCESS_TOKEN_PURPOSES = ['enrol', 'acknowledge', 'passbook'] as const;
export type AccessTokenPurpose = (typeof ACCESS_TOKEN_PURPOSES)[number];

export const NOTIFICATION_SEVERITIES = ['info', 'warn', 'critical'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const MUTATION_DIRECTIONS = ['pre_award_heir', 'post_possession_transfer'] as const;
export type MutationDirection = (typeof MUTATION_DIRECTIONS)[number];

export const LEGAL_CASE_STATUSES = ['filed', 'hearing', 'decided', 'appealed', 'closed'] as const;
export type LegalCaseStatus = (typeof LEGAL_CASE_STATUSES)[number];

export const SEVERANCE_DECISIONS = ['pending', 'acquire_whole', 's28_damages', 'rejected'] as const;
export type SeveranceDecision = (typeof SEVERANCE_DECISIONS)[number];

export const UTILISATION_STATUSES = ['pending', 'utilised', 'unutilised'] as const;
export type UtilisationStatus = (typeof UTILISATION_STATUSES)[number];

export const REVERSIONS = ['owner', 'land_bank', 'custody_transfer'] as const;
export type Reversion = (typeof REVERSIONS)[number];

export const MONITORING_COMMITTEES = ['national', 'state'] as const;
export type MonitoringCommittee = (typeof MONITORING_COMMITTEES)[number];

// ---------------------------------------------------------------------------------------------
// §39.2 document types

export const DOC_TYPES = [
  'DPR_SUMMARY',
  'ADMIN_FINANCIAL_SANCTION',
  'FUNDING_CLEARANCE',
  'REQUISITION_APPLICATION',
  'LAND_SCHEDULE_MATRIX',
  'ALIGNMENT_OVERLAY_MAP',
  'MIN_LAND_JUSTIFICATION',
  'ORDER_OF_ACCEPTANCE',
  'ESCROW_DEMAND_NOTE',
  'ESCROW_DEPOSIT_RECEIPT',
  'FINANCIAL_SUFFICIENCY_CERTIFICATE',
  'S4_SIA_NOTIFICATION',
  'SIA_AGENCY_MOU_TOR',
  'SIA_CENSUS_EXPORT',
  'CPR_INVENTORY_REPORT',
  'SIA_REPORT_DRAFT',
  'SIA_REPORT_FINAL',
  'SIMP_DRAFT',
  'SIMP_FINAL',
  'HEARING_NOTICE',
  'LOCAL_LANGUAGE_SUMMARY',
  'HEARING_RECORDING',
  'ATTENDANCE_REGISTER',
  'HEARING_MINUTES',
  'PUBLIC_HEARING_RESPONSE_MATRIX',
  'EXPERT_GROUP_GAZETTE_ORDER',
  'COI_DECLARATION',
  'EXPERT_RECOMMENDATION_REPORT',
  'DISSENT_NOTE',
  'GOVERNMENT_OVERRIDE_ORDER',
  'CONSENT_REGISTER_DRAFT',
  'CONSENT_REGISTER_CERTIFIED',
  'CONSENT_FORM',
  'DLSA_OBSERVER_CERTIFICATE',
  'CERTIFICATE_OF_CONSENT_PROCUREMENT',
  'CONSENT_TERMINATION_ORDER',
  'S11_NOTIFICATION',
  'GAZETTE_COPY',
  'NEWSPAPER_CLIPPING',
  'AFFIXATION_CERTIFICATE',
  'TRANSFER_FREEZE_ORDER',
  'S12_NOTICE_OF_ENTRY',
  'JOINT_INSPECTION_REPORT',
  'OBJECTION_WRITTEN',
  'S15_HEARING_NOTICE',
  'LAO_INQUIRY_REPORT',
  'GOVERNMENT_ORDER_ON_OBJECTIONS',
  'DENOTIFICATION_ORDER',
  'RNR_CENSUS_EXPORT',
  'RNR_SCHEME_DRAFT',
  'RNR_SCHEME_APPROVED',
  'RNR_COMMISSIONER_ORDER',
  'RESETTLEMENT_COLONY_LAYOUT',
  'COMMISSIONING_CERTIFICATE',
  'RNR_PASSBOOK',
  'S19_DECLARATION',
  'S21_NOTICE',
  'CLAIM_PETITION',
  'TITLE_DOCUMENT',
  'VALUATION_REPORT_PWD',
  'VALUATION_REPORT_FOREST',
  'VALUATION_REPORT_HORTICULTURE',
  'VALUATION_REPORT_IRRIGATION',
  'CIRCLE_RATE_SCHEDULE',
  'SALE_DEEDS_REGISTER',
  'AWARD_LAND',
  'AWARD_RNR',
  'S37_NOTICE',
  'INDEMNITY_BOND',
  'PAYMENT_ACCEPTANCE_FORM',
  'TREASURY_PAYMENT_ADVICE',
  'VACATION_CERTIFICATE',
  'S38_POSSESSION_NOTICE',
  'POSSESSION_PANCHNAMA',
  'CERTIFICATE_OF_POSSESSION',
  'HANDOVER_CERTIFICATE',
  'MUTATION_EXTRACT',
  'S64_REFERENCE_APPLICATION',
  'AUTHORITY_ORDER',
  'APPEAL_ORDER',
  'SEVERANCE_CLAIM',
  'SEVERANCE_INSPECTION_REPORT',
  'UTILISATION_INSPECTION_CERTIFICATE',
  'REVERSION_DEED',
  'VALUE_SHARING_SHEET',
  'MONITORING_AUDIT_REPORT',
  'ASSET_HANDOVER_CERTIFICATE',
  'FIELD_PHOTO',
  'PILLAR_PHOTO',
  'OTHER',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

// §39.3 Third Schedule amenity codes — stored as text on amenity_milestones.
export const AMENITY_CODES = [
  'ROADS_ALL_WEATHER_LINK',
  'DRAINAGE_SANITATION',
  'SAFE_DRINKING_WATER',
  'CATTLE_DRINKING_WATER',
  'GRAZING_LAND',
  'FAIR_PRICE_SHOP',
  'PANCHAYAT_GHAR',
  'POST_OFFICE_SAVINGS',
  'SEED_FERTILIZER_STORAGE',
  'BASIC_IRRIGATION',
  'TRANSPORT_LINK',
  'BURIAL_CREMATION_GROUND',
  'INDIVIDUAL_TOILETS',
  'ELECTRIC_CONNECTIONS',
  'ANGANWADI',
  'SCHOOL_RTE',
  'SUB_HEALTH_CENTRE_2KM',
  'PRIMARY_HEALTH_CENTRE',
  'CHILDREN_PLAYGROUND',
  'COMMUNITY_CENTRE_PER_100',
  'WORSHIP_CHOWPAL_PER_50',
  'TRIBAL_INSTITUTION_LAND',
  'FOREST_RIGHTS_CPR_ACCESS',
  'SECURITY_ARRANGEMENTS',
  'VETERINARY_CENTRE',
] as const;
export type AmenityCode = (typeof AMENITY_CODES)[number];
