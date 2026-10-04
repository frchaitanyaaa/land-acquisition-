'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { MockBanner } from '@/components/mock/mock-banner';
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  fileGrievance,
  getCitizen,
  loadGrievances,
  type GrievanceCategory,
  type MockCitizen,
  type MockGrievance,
} from '@/lib/mock-citizen';
import { usePortal } from '../portal-shell';

const DISTRICTS = ['Pune', 'Satara', 'Nagpur', 'Gadchiroli', 'Belagavi', 'Dharwad', 'Ahmedabad', 'Jaisalmer', 'Gautam Buddh Nagar'];

/** File a grievance and see your own (MOCK — browser only, see lib/mock-citizen.ts). */
export function GrievanceDesk() {
  const { formatDate } = usePortal();
  const [citizen, setCitizen] = useState<MockCitizen | null>(null);
  const [mine, setMine] = useState<MockGrievance[]>([]);
  const [filed, setFiled] = useState<MockGrievance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    category: 'PAYMENT_NOT_RECEIVED' as GrievanceCategory,
    district: 'Pune',
    village: '',
    subject: '',
    body: '',
    name: '',
    phone: '',
  });

  useEffect(() => {
    const c = getCitizen();
    setCitizen(c);
    if (c) setForm((f) => ({ ...f, name: c.name }));
    void loadGrievances().then((all) => setMine(c ? all.filter((g) => g.phoneMasked === c.phoneMasked) : []));
  }, [filed]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.subject.trim() || !form.body.trim()) return setError('Add a subject and describe the problem.');
    if (!citizen && form.phone.replace(/\D/g, '').length !== 10) return setError('Enter a 10-digit mobile number.');
    const g = await fileGrievance({
      category: form.category,
      subject: form.subject.trim(),
      body: form.body.trim(),
      village: form.village.trim(),
      district: form.district,
      citizenName: (citizen?.name ?? form.name.trim()) || 'Citizen',
      phone: citizen ? citizen.phoneMasked.replace(/X/g, '0') : form.phone,
    });
    setFiled(g);
    setForm((f) => ({ ...f, subject: '', body: '' }));
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section className="space-y-5">
      <MockBanner what="The grievance register" />

      {filed && (
        <div role="status" className="space-y-2 rounded-lg border border-teal-300 bg-teal-50 p-5">
          <p className="text-sm text-teal-900">Your grievance is registered. Keep this tracking number:</p>
          <p className="font-mono text-2xl font-semibold tracking-wide text-teal-950">{filed.trackingNo}</p>
          <p className="text-sm text-teal-900">
            Assigned to {filed.assignedTo}. Response target: {formatDate(filed.slaDueAt)} (administrative target).
          </p>
          <Link href={`/portal/track?no=${filed.trackingNo}`} className="inline-block text-sm font-medium text-teal-800 underline">
            Track this grievance
          </Link>
        </div>
      )}

      <form onSubmit={(e) => void submit(e)} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-2">
        <h2 className="text-lg font-semibold text-slate-950 md:col-span-2">File a grievance</h2>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">What is it about?</span>
          <select value={form.category} onChange={set('category')} className="input">
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">District</span>
          <select value={form.district} onChange={set('district')} className="input">
            {DISTRICTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">Village</span>
          <input value={form.village} onChange={set('village')} className="input" placeholder="e.g. Khed Shivapur" />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium text-slate-800">Subject</span>
          <input value={form.subject} onChange={set('subject')} className="input" maxLength={120} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium text-slate-800">Describe the problem</span>
          <textarea value={form.body} onChange={set('body')} rows={4} className="input" maxLength={2000} />
        </label>
        {!citizen && (
          <>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-800">Your name</span>
              <input value={form.name} onChange={set('name')} className="input" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-800">Mobile number</span>
              <input value={form.phone} onChange={set('phone')} inputMode="numeric" className="input" placeholder="10 digits" />
            </label>
          </>
        )}
        {error && <p className="text-sm text-red-700 md:col-span-2">{error}</p>}
        <div className="flex flex-wrap items-center gap-4 md:col-span-2">
          <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Submit grievance
          </button>
          {citizen ? (
            <span className="text-sm text-slate-600">
              Filing as {citizen.name} ({citizen.phoneMasked})
            </span>
          ) : (
            <Link href="/portal/login" className="text-sm text-teal-800 underline">
              Sign in to see all your grievances
            </Link>
          )}
        </div>
      </form>

      {citizen && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-950">My grievances</h2>
          {mine.length === 0 ? (
            <p className="text-sm text-slate-600">You have not filed any grievance yet.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {mine.map((g) => (
                <li key={g.trackingNo} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-mono text-sm text-slate-600">{g.trackingNo}</p>
                    <p className="font-medium text-slate-950">{g.subject}</p>
                    <p className="text-xs text-slate-600">
                      {CATEGORY_LABEL[g.category]} · filed {formatDate(g.filedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">{STATUS_LABEL[g.status]}</span>
                    <Link href={`/portal/track?no=${g.trackingNo}`} className="text-sm text-teal-800 underline">
                      Track
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
