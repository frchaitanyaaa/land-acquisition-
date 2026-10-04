import type { Role } from '@bhoomisetu/shared';
import type { Post } from '@/lib/api';

/**
 * Officer sidebar (01-chaitanya.md C1 §3). One list for every role; `roles` hides an item from posts
 * that cannot use it (the API still enforces access — G13 — this only keeps the menu relevant).
 *
 * `pending: true` = the page has not landed yet. It renders as a disabled row with a "Soon" tag.
 * Whoever ships the page flips the flag in the same commit.
 */
export interface NavItem {
  key: string;
  label: string;
  /** One line under the label. */
  description: string;
  /** Material icon name (rendered with ux4g-icon-outlined). */
  icon: string;
  /** Static path, or a builder for paths that need the post's codes or the selected project. */
  href: string | ((ctx: NavContext) => string | null);
  /** Needs a selected project (the top bar's project switcher). */
  projectScoped?: boolean;
  roles?: readonly Role[];
  pending?: boolean;
  /** Not a Next.js route (e.g. the static field PWA) — use a plain <a>. */
  external?: boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
}

export interface NavContext {
  post: Post;
  projectId: string | null;
}

const NATIONAL_STATE: readonly Role[] = [
  'SUPER_ADMIN',
  'CENTRAL_VIEWER',
  'POLICY_MAKER',
  'MONITORING_COMMITTEE',
  'STATE_REVENUE',
  'RNR_COMMISSIONER',
];
const DISTRICT_DESK: readonly Role[] = ['SUPER_ADMIN', 'COLLECTOR', 'LAO'];
const AUDIT: readonly Role[] = ['SUPER_ADMIN', 'CENTRAL_VIEWER', 'MONITORING_COMMITTEE'];
const FIELD: readonly Role[] = ['SUPER_ADMIN', 'TEHSILDAR', 'DILR', 'FIELD_OFFICER'];

const inProject = (suffix: string) => (ctx: NavContext) =>
  ctx.projectId ? `/project/${ctx.projectId}${suffix}` : null;

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Overview',
    items: [
      {
        key: 'national',
        label: 'National dashboard',
        description: 'All-India KPIs, breaches, money gap',
        icon: 'public',
        href: '/national',
        roles: NATIONAL_STATE,
      },
      {
        key: 'state',
        label: 'State dashboard',
        description: 'Your state, district by district',
        icon: 'map',
        href: (ctx) => (ctx.post.stateCode ? `/state/${ctx.post.stateCode}` : null),
      },
      {
        key: 'district',
        label: 'District dashboard',
        description: 'Projects and deadlines in your district',
        icon: 'location_city',
        href: (ctx) => (ctx.post.districtCode ? `/district/${ctx.post.districtCode}` : null),
      },
      {
        key: 'collector',
        label: 'Collector desk',
        description: 'What breaches a deadline on my watch',
        icon: 'gavel',
        href: '/collector',
        roles: DISTRICT_DESK,
      },
      {
        key: 'proposals',
        label: 'Proposals',
        description: 'Submitted, returned and accepted',
        icon: 'inbox',
        href: '/proposals',
      },
    ],
  },
  {
    key: 'land',
    label: 'Land',
    items: [
      {
        key: 'gis',
        label: 'GIS map',
        description: 'Parcels, corridors and constraint layers',
        icon: 'layers',
        href: '/gis',
      },
      {
        key: 'parcels',
        label: 'Land parcels',
        description: 'Parcels of the selected project',
        icon: 'grid_view',
        href: inProject('/parcels'),
        projectScoped: true,
      },
      {
        key: 'field-office',
        label: 'Field office',
        description: 'Verify surveys and corrections',
        icon: 'fact_check',
        href: '/field-office',
        roles: FIELD,
      },
      {
        key: 'field-app',
        label: 'Field app',
        description: 'Offline walk-and-mark on a phone',
        icon: 'smartphone',
        href: '/field',
        roles: FIELD,
        external: true,
      },
    ],
  },
  {
    key: 'acquisition',
    label: 'Acquisition',
    items: [
      {
        key: 'workspace',
        label: 'Project workspace',
        description: 'Stages, checklist and next action',
        icon: 'work',
        href: inProject('/timeline'),
        projectScoped: true,
      },
      {
        key: 'award',
        label: 'Award',
        description: 'Award entry, OCR review, checks',
        icon: 'description',
        href: inProject('/award'),
        projectScoped: true,
      },
      {
        key: 'families',
        label: 'Families & money',
        description: 'Disbursed vs acknowledged',
        icon: 'family_restroom',
        href: inProject('/families'),
        projectScoped: true,
      },
      {
        key: 'possession',
        label: 'Possession',
        description: 'Recorded per parcel, after the gate',
        icon: 'key',
        href: inProject('/parcels'),
        projectScoped: true,
      },
      {
        key: 'objections',
        label: 'Objections',
        description: 's.15 objections and hearings',
        icon: 'record_voice_over',
        href: inProject('/objections'),
        projectScoped: true,
      },
      {
        key: 'grievances',
        label: 'Grievances',
        description: 'Citizen grievances and SLA',
        icon: 'support_agent',
        href: '/grievances',
      },
      {
        key: 'citizen-portal',
        label: 'Citizen portal',
        description: 'What citizens see, without login',
        icon: 'groups',
        href: '/portal',
      },
    ],
  },
  {
    key: 'monitoring',
    label: 'Monitoring',
    items: [
      {
        key: 'deadlines',
        label: 'Deadlines & alerts',
        description: 'Statutory clocks and consequences',
        icon: 'alarm',
        href: '/deadlines',
      },
      {
        key: 'analytics',
        label: 'Analytics',
        description: 'Risk score (advisory) and bottlenecks',
        icon: 'insights',
        href: '/analytics',
      },
      {
        key: 'reports',
        label: 'Reports (MIS)',
        description: 'CSV and PDF exports',
        icon: 'summarize',
        href: '/reports',
      },
      {
        key: 'rule-packs',
        label: 'Rule packs',
        description: 'Statute and state rules, versioned',
        icon: 'rule',
        href: '/rule-packs',
      },
    ],
  },
  {
    key: 'trust',
    label: 'Trust',
    items: [
      {
        key: 'trust-center',
        label: 'Trust center',
        description: 'Blockchain anchors and record verification',
        icon: 'verified_user',
        href: '/trust',
      },
      {
        key: 'audit-log',
        label: 'Audit log',
        description: 'Hash-chained record of every change',
        icon: 'history',
        href: '/trust/audit',
        roles: AUDIT,
      },
    ],
  },
];

/** Register new project is for whoever submits proposals; the API decides who may submit. */
export const QUICK_ACTIONS = {
  newProject: { label: 'Register new project', href: '/projects/new', icon: 'add_circle' },
} as const;

export function visibleItems(group: NavGroup, role: string): NavItem[] {
  return group.items.filter((i) => !i.roles || i.roles.includes(role as Role));
}

export function resolveHref(item: NavItem, ctx: NavContext): string | null {
  return typeof item.href === 'string' ? item.href : item.href(ctx);
}
