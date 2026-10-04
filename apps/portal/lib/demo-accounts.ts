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
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    login: 'oversight',
    screen: 'National dashboard',
    post: 'Central Monitoring Cell, MoRD',
    look: 'All-India KPIs, 3 breach alerts, payment gap, map',
  },
  {
    login: 'revenue.mh',
    screen: 'State dashboard',
    post: 'Revenue Department, Maharashtra',
    look: 'Maharashtra projects, district by district',
  },
  {
    login: 'collector.pune',
    screen: 'Collector desk',
    post: 'Collector, Pune',
    look: 'Deadline board, s.19 lapse in 34 days, approves stages',
  },
  {
    login: 'lao.satara',
    screen: 'District dashboard',
    post: 'Land Acquisition Officer, Satara',
    look: 'Submits stages, enters awards, pays and takes possession',
  },
  {
    login: 'tehsildar.haveli',
    screen: 'Field office',
    post: 'Tehsildar, Haveli',
    look: 'Verifies surveyed parcels, approves corrections',
  },
  {
    login: 'talathi.khedshivapur',
    screen: 'Field app (mobile)',
    post: 'Talathi, Khed Shivapur',
    look: 'Walk the boundary with GPS + photo, works offline',
    fieldApp: true,
  },
  {
    login: 'pd.nhai',
    screen: 'Proposals (requiring body)',
    post: 'Project Director, NHAI',
    look: 'Its own projects only, enforced by the database',
  },
  {
    login: 'demo',
    screen: 'Role switcher',
    post: 'Several posts',
    look: 'Pick a post after sign-in, switch any time',
  },
];

export const demoEmail = (a: Pick<DemoAccount, 'login'>) => `${a.login}@${DEMO_DOMAIN}`;
