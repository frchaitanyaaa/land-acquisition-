'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { MockBanner } from '@/components/mock/mock-banner';
import { getCitizen, mockOtpFor, signInCitizen, signOutCitizen, type MockCitizen } from '@/lib/mock-citizen';

/** Citizen sign-in (MOCK): phone + one-time code. The code is shown on screen, as the dev SMS inbox would. */
export default function CitizenLoginPage() {
  const [citizen, setCitizen] = useState<MockCitizen | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setCitizen(getCitizen()), []);

  const phoneOk = phone.replace(/\D/g, '').length === 10;

  function sendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter your name.');
    if (!phoneOk) return setError('Enter a 10-digit mobile number.');
    setSent(mockOtpFor(phone));
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (otp.trim() !== sent) return setError('That code does not match. Check the code shown above.');
    setCitizen(await signInCitizen(name.trim(), phone));
  }

  if (citizen)
    return (
      <div className="max-w-xl space-y-6">
        <MockBanner what="Citizen sign-in" />
        <h1 className="text-2xl font-semibold text-slate-950">Signed in as {citizen.name}</h1>
        <p className="text-slate-700">Mobile {citizen.phoneMasked}. You can now file and follow grievances.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/portal/grievance" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            File or view my grievances
          </Link>
          <button
            type="button"
            onClick={() => {
              signOutCitizen();
              setCitizen(null);
              setSent(null);
              setOtp('');
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    );

  return (
    <div className="max-w-xl space-y-6">
      <MockBanner what="Citizen sign-in" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-950">Citizen sign-in</h1>
        <p className="text-slate-700">
          Searching land, reading notices and tracking a grievance need no account. Sign in to see your own grievances in one
          place.
        </p>
      </div>

      {!sent ? (
        <form onSubmit={sendOtp} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-800">Your name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-800">Mobile number</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="numeric"
              placeholder="10 digits"
              className="input"
              autoComplete="tel"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
            Send one-time code
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => void verify(e)} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5">
          <p className="rounded bg-slate-100 px-3 py-2 text-sm text-slate-800">
            <span className="mr-2 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold">MOCK SMS</span>
            Your code is <strong className="font-mono">{sent}</strong>
          </p>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-slate-800">Enter the 6-digit code</span>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} className="input font-mono" />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">
              Verify and sign in
            </button>
            <button type="button" onClick={() => setSent(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100">
              Change number
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
