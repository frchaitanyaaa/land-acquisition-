import type { Post } from './api';

/**
 * Display labels for the Role enum (CLAUDE.md §10.2). Roles attach to posts, not people (G19),
 * so everything here takes a post.
 */
const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'System administrator',
  CENTRAL_VIEWER: 'Central oversight',
  POLICY_MAKER: 'Policy maker',
  STATE_REVENUE: 'State Revenue Department',
  RNR_COMMISSIONER: 'Commissioner for R&R',
  COLLECTOR: 'Collector',
  LAO: 'Land Acquisition Officer',
  DISTRICT_STAFF: 'District staff',
  RNR_ADMINISTRATOR: 'Administrator for R&R',
  TEHSILDAR: 'Tehsildar',
  DILR: 'DILR (land records)',
  FIELD_OFFICER: 'Field officer',
  REQUIRING_BODY: 'Requiring body',
  SIA_AGENCY: 'SIA agency',
  EXPERT_GROUP_MEMBER: 'Expert group member',
  DLSA_OBSERVER: 'DLSA observer',
  TREASURY_OFFICER: 'Treasury officer',
  LEGAL_CELL: 'Legal cell',
  MONITORING_COMMITTEE: 'Monitoring committee',
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export function jurisdictionText(post: Pick<Post, 'level' | 'stateCode' | 'districtCode'>): string {
  if (post.districtCode) return `District ${post.districtCode}`;
  if (post.stateCode) return `State ${post.stateCode}`;
  if (post.level === 'NATIONAL') return 'National';
  return post.level;
}

/** Roles whose first screen is the national (oversight) dashboard. */
const NATIONAL_HOME = new Set(['SUPER_ADMIN', 'CENTRAL_VIEWER', 'POLICY_MAKER', 'MONITORING_COMMITTEE']);
/** State-level posts open on their own state's dashboard. */
const STATE_HOME = new Set(['STATE_REVENUE', 'RNR_COMMISSIONER']);
/** Field posts open on the field-office workspace (verification queue, surveys). */
const FIELD_HOME = new Set(['TEHSILDAR', 'DILR', 'FIELD_OFFICER']);

/**
 * Where a post lands after sign-in or a post switch — one distinct screen per kind of post, so the evaluator
 * accounts in lib/demo-accounts.ts never lead to the same page. Navigation only: what each screen shows is
 * decided by the API and RLS (G13).
 */
export function homeFor(post: Pick<Post, 'role' | 'level' | 'stateCode' | 'districtCode'>): string {
  if (post.role === 'COLLECTOR') return '/collector';
  if (post.role === 'LAO' && post.districtCode) return `/district/${post.districtCode}`;
  if (STATE_HOME.has(post.role) && post.stateCode) return `/state/${post.stateCode}`;
  if (NATIONAL_HOME.has(post.role) || post.level === 'NATIONAL') return '/national';
  if (FIELD_HOME.has(post.role)) return '/field-office';
  if (post.role === 'REQUIRING_BODY') return '/proposals';
  // Treasury, R&R administrator and case participants start on the map of the projects their scope can see.
  return '/gis';
}
