/**
 * The synthetic demo accounts shown to evaluators (G18), one per distinct screen. The landing page sheet and the
 * login page chips both read this list, so they never drift apart. Shown only when DEMO_MODE=true.
 * Other seeded accounts still sign in if typed; they are left off to avoid several cards leading to one screen.
 */
export const DEMO_PASSWORD = 'bhoomisetu-demo';
export const DEMO_DOMAIN = 'bhoomisetu.local';

export interface DemoAccount {
  /** Part before @bhoomisetu.local. */
  login: string;
  /** The screen this account opens on (lib/roles.ts homeFor). */
  screen: string;
  post: string;
  look: string;
  /** The field app has its own sign-in at /field/; the card links there instead of prefilling the portal form. */
  fieldApp?: boolean;
  /** Two or three words for the landing page card ("Ministry view"). */
  role: string;
  /** Material Symbols name (UX4G icon font). */
  icon: string;
  /** Shown as a main card on the landing page; the rest sit under "More roles". */
  primary?: boolean;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    login: 'oversight',
    role: 'Ministry view',
    icon: 'public',
    primary: true,
    screen: 'National dashboard',
    post: 'Central Monitoring Cell, MoRD',
    look: 'All-India KPIs, 3 breach alerts, payment gap, map',
  },
  {
    login: 'revenue.mh',
    role: 'State officer',
    icon: 'map',
    screen: 'State dashboard',
    post: 'Revenue Department, Maharashtra',
    look: 'Maharashtra projects, district by district',
  },
  {
    login: 'collector.pune',
    role: 'District Collector',
    icon: 'gavel',
    primary: true,
    screen: 'Collector desk',
    post: 'Collector, Pune',
    look: 'Deadline board, s.19 lapse in 34 days, approves stages',
  },
  {
    login: 'lao.satara',
    role: 'Land Acquisition Officer',
    icon: 'assignment',
    screen: 'District dashboard',
    post: 'Land Acquisition Officer, Satara',
    look: 'Submits stages, enters awards, pays and takes possession',
  },
  {
    login: 'tehsildar.haveli',
    role: 'Tehsildar',
    icon: 'fact_check',
    screen: 'Field office',
    post: 'Tehsildar, Haveli',
    look: 'Verifies surveyed parcels, approves corrections',
  },
  {
    login: 'talathi.khedshivapur',
    role: 'Field officer',
    icon: 'smartphone',
    primary: true,
    screen: 'Field app (mobile)',
    post: 'Talathi, Khed Shivapur',
    look: 'Walk the boundary with GPS + photo, works offline',
    fieldApp: true,
  },
  {
    login: 'pd.nhai',
    role: 'Requiring body (NHAI)',
    icon: 'inbox',
    screen: 'Proposals (requiring body)',
    post: 'Project Director, NHAI',
    look: 'Its own projects only, enforced by the database',
  },
  {
    login: 'demo',
    role: 'Several posts',
    icon: 'switch_account',
    screen: 'Role switcher',
    post: 'Several posts',
    look: 'Pick a post after sign-in, switch any time',
  },
];

export const demoEmail = (a: Pick<DemoAccount, 'login'>) => `${a.login}@${DEMO_DOMAIN}`;
