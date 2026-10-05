/**
 * "Login as" roles for the officer sign-in (CLAUDE.md §25: the officer picks a role, the server signs into
 * their post with that role). In DEMO_MODE, choosing a role fills in that role's synthetic account (G18), so an
 * evaluator signs in with two clicks. The field officer signs in on the field app instead (/field).
 */
import type { Role } from '@bhoomisetu/shared';

export const DEMO_PASSWORD = 'bhoomisetu-demo';
export const DEMO_DOMAIN = 'bhoomisetu.local';

export interface LoginRole {
  role: Role;
  /** Shown in the "Login as" list. */
  label: string;
  /** What this role's dashboard is for, one line. */
  hint: string;
  /** Demo mode: the synthetic account for this role (part before @bhoomisetu.local). */
  demo: string;
  /** The field app has its own sign-in at /field/. */
  fieldApp?: boolean;
}

export const LOGIN_ROLES: LoginRole[] = [
  { role: 'CENTRAL_VIEWER', label: 'Central monitoring (MoRD)', hint: 'National dashboard: all states, breaches, payment gap', demo: 'oversight' },
  { role: 'STATE_REVENUE', label: 'State Revenue Department', hint: 'State dashboard, district by district', demo: 'revenue.mh' },
  { role: 'COLLECTOR', label: 'Collector', hint: 'Deadline board; approves stages and awards', demo: 'collector.pune' },
  { role: 'LAO', label: 'Land Acquisition Officer', hint: 'Prepares stages, enters awards, pays, takes possession', demo: 'lao.satara' },
  { role: 'TEHSILDAR', label: 'Tehsildar', hint: 'Verifies surveyed parcels and corrections', demo: 'tehsildar.haveli' },
  { role: 'DILR', label: 'DILR (land records)', hint: 'Verifies surveyed parcels and corrections', demo: 'dilr.pune' },
  { role: 'RNR_COMMISSIONER', label: 'Commissioner for R&R', hint: 'Approves R&R schemes for the state', demo: 'rnr.commissioner.mh' },
  { role: 'RNR_ADMINISTRATOR', label: 'Administrator for R&R', hint: 'R&R census, schemes and resettlement sites', demo: 'rnr.satara' },
  { role: 'TREASURY_OFFICER', label: 'Treasury officer', hint: 'Escrow and payments', demo: 'treasury.satara' },
  { role: 'REQUIRING_BODY', label: 'Requiring body (e.g. NHAI)', hint: 'Its own proposals and projects only', demo: 'pd.nhai' },
  { role: 'LEGAL_CELL', label: 'Legal cell', hint: 'Reference cases and appeals', demo: 'legal.mh' },
  { role: 'FIELD_OFFICER', label: 'Field officer (Talathi)', hint: 'Signs in on the field app on a phone', demo: 'talathi.khedshivapur', fieldApp: true },
];

export const demoEmail = (login: string) => `${login}@${DEMO_DOMAIN}`;
