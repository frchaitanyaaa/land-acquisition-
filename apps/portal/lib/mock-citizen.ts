'use client';

/**
 * STANDALONE MOCK — citizen sign-in and grievances (CLAUDE.md §25, decided 4 Oct 2026).
 *
 * There is no citizen-account or grievance backend in this release. This module mimics the intended
 * flow entirely in the browser (localStorage) so the demo can show it: a citizen signs in with a phone
 * OTP, files a grievance, gets a tracking number and follows its timeline; an officer works the same
 * grievance from /grievances. Nothing is sent to any office or stored on the server, every record is
 * synthetic (G18) and every screen that uses it shows a MOCK badge (G7). Same browser only.
 */

export type GrievanceCategory =
  | 'COMPENSATION'
  | 'PAYMENT_NOT_RECEIVED'
  | 'SURVEY_ERROR'
  | 'NOTICE_NOT_RECEIVED'
  | 'RNR'
  | 'OTHER';

export const CATEGORY_LABEL: Record<GrievanceCategory, string> = {
  COMPENSATION: 'Compensation amount',
  PAYMENT_NOT_RECEIVED: 'Payment not received',
  SURVEY_ERROR: 'Survey or boundary error',
  NOTICE_NOT_RECEIVED: 'Notice not received',
  RNR: 'Rehabilitation & resettlement',
  OTHER: 'Something else',
};

export type GrievanceStatus = 'FILED' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESPONDED' | 'CLOSED';

export const STATUS_LABEL: Record<GrievanceStatus, string> = {
  FILED: 'Filed',
  ASSIGNED: 'Assigned to officer',
  IN_PROGRESS: 'In progress',
  RESPONDED: 'Response sent',
  CLOSED: 'Closed',
};

export interface GrievanceEvent {
  at: string;
  status: GrievanceStatus;
  note: string;
  by: string; // 'Citizen' or an officer post designation
}

export interface MockGrievance {
  trackingNo: string;
  category: GrievanceCategory;
  subject: string;
  body: string;
  village: string;
  district: string;
  citizenName: string;
  phoneMasked: string;
  status: GrievanceStatus;
  assignedTo: string;
  filedAt: string;
  slaDueAt: string;
  events: GrievanceEvent[];
  dataSource: 'SYNTHETIC_DEMO';
}

export interface MockCitizen {
  name: string;
  phoneMasked: string;
  signedInAt: string;
}

/** Administrative response target for the mock — not a statutory period. */
export const MOCK_GRIEVANCE_SLA_DAYS = 15;

const KEY = 'bs-mock-grievances-v1';
const SESSION_KEY = 'bs-mock-citizen-v1';
const DAY_MS = 24 * 60 * 60 * 1000;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window / storage blocked: the mock just does not persist */
  }
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '').slice(-10);
  return d.length < 4 ? 'XXXXXXXXXX' : `${d.slice(0, 2)}XXXXXX${d.slice(-2)}`;
}

/** The demo's statutory clock (frozen DEMO_NOW) when the API is up; the browser clock otherwise. */
export async function demoNow(): Promise<Date> {
  try {
    const res = await fetch('/api/v1/health', { cache: 'no-store' });
    if (res.ok) {
      const h = (await res.json()) as { clock?: { now?: string } };
      if (h.clock?.now) return new Date(h.clock.now);
    }
  } catch {
    /* fall through */
  }
  return new Date();
}

function addDays(d: Date, days: number): string {
  return new Date(d.getTime() + days * DAY_MS).toISOString();
}

function seed(now: Date): MockGrievance[] {
  const mk = (
    n: number,
    category: GrievanceCategory,
    subject: string,
    village: string,
    district: string,
    citizenName: string,
    phoneMasked: string,
    daysAgo: number,
    status: GrievanceStatus,
  ): MockGrievance => {
    const filed = new Date(now.getTime() - daysAgo * DAY_MS);
    const events: GrievanceEvent[] = [{ at: filed.toISOString(), status: 'FILED', note: 'Filed on the public portal.', by: 'Citizen' }];
    const order: GrievanceStatus[] = ['ASSIGNED', 'IN_PROGRESS', 'RESPONDED', 'CLOSED'];
    const notes: Record<string, string> = {
      ASSIGNED: 'Assigned to the Special Land Acquisition Officer of the district.',
      IN_PROGRESS: 'Records requested from the Talathi; site visit scheduled.',
      RESPONDED: 'Reply sent: the corrected entry will appear in your passbook.',
      CLOSED: 'Closed after the citizen confirmed the correction.',
    };
    for (const [i, s] of order.entries()) {
      if (order.indexOf(status) < i) break;
      events.push({ at: addDays(filed, i + 1), status: s, note: notes[s] ?? '', by: `LAO, ${district}` });
    }
    return {
      trackingNo: `GRV-2026-${String(n).padStart(6, '0')}`,
      category,
      subject,
      body: subject,
      village,
      district,
      citizenName,
      phoneMasked,
      status,
      assignedTo: `Special Land Acquisition Officer, ${district}`,
      filedAt: filed.toISOString(),
      slaDueAt: addDays(filed, MOCK_GRIEVANCE_SLA_DAYS),
      events,
      dataSource: 'SYNTHETIC_DEMO',
    };
  };
  return [
    mk(101, 'PAYMENT_NOT_RECEIVED', 'Second instalment shown as paid but not in my account', 'Khed Shivapur', 'Pune', 'Sunita Pawar', '98XXXXXX41', 3, 'ASSIGNED'),
    mk(102, 'SURVEY_ERROR', 'Well on survey 214/3 missing from the joint inspection list', 'Shirwal', 'Satara', 'Ganesh Jadhav', '97XXXXXX18', 9, 'IN_PROGRESS'),
    mk(103, 'NOTICE_NOT_RECEIVED', 'No individual s.21 notice received', 'Khed Shivapur', 'Pune', 'Ramesh Kale', '99XXXXXX07', 18, 'FILED'),
    mk(104, 'RNR', 'Cattle shed grant not listed in passbook', 'Shirwal', 'Satara', 'Anita More', '98XXXXXX63', 25, 'RESPONDED'),
    mk(105, 'COMPENSATION', 'Tenant share not reflected in award', 'Khed Shivapur', 'Pune', 'Vitthal Shinde', '96XXXXXX92', 40, 'CLOSED'),
  ];
}

export async function loadGrievances(): Promise<MockGrievance[]> {
  const existing = read<MockGrievance[] | null>(KEY, null);
  if (existing) return existing;
  const seeded = seed(await demoNow());
  write(KEY, seeded);
  return seeded;
}

export function saveGrievances(list: MockGrievance[]): void {
  write(KEY, list);
}

export async function fileGrievance(input: {
  category: GrievanceCategory;
  subject: string;
  body: string;
  village: string;
  district: string;
  citizenName: string;
  phone: string;
}): Promise<MockGrievance> {
  const list = await loadGrievances();
  const now = await demoNow();
  const next = list.reduce((m, g) => Math.max(m, Number(g.trackingNo.slice(-6)) || 0), 100) + 1;
  const g: MockGrievance = {
    trackingNo: `GRV-2026-${String(next).padStart(6, '0')}`,
    category: input.category,
    subject: input.subject,
    body: input.body,
    village: input.village,
    district: input.district,
    citizenName: input.citizenName,
    phoneMasked: maskPhone(input.phone),
    status: 'FILED',
    assignedTo: `Special Land Acquisition Officer, ${input.district || 'district'}`,
    filedAt: now.toISOString(),
    slaDueAt: addDays(now, MOCK_GRIEVANCE_SLA_DAYS),
    events: [{ at: now.toISOString(), status: 'FILED', note: 'Filed on the public portal.', by: 'Citizen' }],
    dataSource: 'SYNTHETIC_DEMO',
  };
  saveGrievances([g, ...list]);
  return g;
}

export async function findGrievance(trackingNo: string): Promise<MockGrievance | null> {
  const t = trackingNo.trim().toUpperCase();
  return (await loadGrievances()).find((g) => g.trackingNo === t) ?? null;
}

const NEXT: Partial<Record<GrievanceStatus, GrievanceStatus>> = {
  FILED: 'ASSIGNED',
  ASSIGNED: 'IN_PROGRESS',
  IN_PROGRESS: 'RESPONDED',
  RESPONDED: 'CLOSED',
};

export function nextStatus(s: GrievanceStatus): GrievanceStatus | null {
  return NEXT[s] ?? null;
}

/** Officer action in the mock inbox: move to the next status with a note. */
export async function advanceGrievance(trackingNo: string, note: string, by: string): Promise<MockGrievance | null> {
  const list = await loadGrievances();
  const g = list.find((x) => x.trackingNo === trackingNo);
  const to = g ? nextStatus(g.status) : null;
  if (!g || !to) return g ?? null;
  const now = await demoNow();
  g.status = to;
  g.events.push({ at: now.toISOString(), status: to, note: note || STATUS_LABEL[to], by });
  saveGrievances(list);
  return g;
}

export function resetMock(): void {
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ---- citizen session (mock OTP sign-in) ----

/** The mock OTP is derived from the phone number and shown on screen, like the dev SMS inbox. */
export function mockOtpFor(phone: string): string {
  const d = phone.replace(/\D/g, '');
  let h = 7;
  for (const c of d) h = (h * 31 + Number(c)) % 1_000_000;
  return String(h).padStart(6, '0');
}

export function getCitizen(): MockCitizen | null {
  return read<MockCitizen | null>(SESSION_KEY, null);
}

export async function signInCitizen(name: string, phone: string): Promise<MockCitizen> {
  const c: MockCitizen = { name, phoneMasked: maskPhone(phone), signedInAt: (await demoNow()).toISOString() };
  write(SESSION_KEY, c);
  return c;
}

export function signOutCitizen(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}
