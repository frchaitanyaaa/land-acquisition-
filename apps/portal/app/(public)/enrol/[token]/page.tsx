'use client';

import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { useTranslations } from 'next-intl';
import { use, useEffect, useState } from 'react';
import { ApiProblem } from '@/lib/api';
import { publicApi } from '@/lib/public-api';

/**
 * /enrol/:token — the beneficiary registers THEIR OWN phone's fingerprint/face (§21.2). The
 * officer only shows the QR; the ceremony never runs in the officer's session. We store the
 * credential id and public key only (G6) — the biometric never leaves the phone.
 */
export default function EnrolPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations('enrol');
  const tc = useTranslations('common');
  const [info, setInfo] = useState<{ displayName: string; expired: boolean; used: boolean } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(browserSupportsWebAuthn());
    publicApi<{ displayName: string; expired: boolean; used: boolean }>(`/enrol/${token}`)
      .then(setInfo)
      .catch(() => setInvalid(true));
  }, [token]);

  async function enrol() {
    setState('busy');
    setError(null);
    try {
      const optionsJSON = await publicApi<Parameters<typeof startRegistration>[0]['optionsJSON']>(`/enrol/${token}/options`);
      const response = await startRegistration({ optionsJSON });
      await publicApi(`/enrol/${token}/verify`, {
        method: 'POST',
        body: JSON.stringify({ response, deviceLabel: navigator.userAgent.slice(0, 120) }),
      });
      setState('done');
    } catch (e) {
      setState('idle');
      if (e instanceof Error && e.name === 'NotAllowedError') return; // cancelled
      setError(e instanceof ApiProblem ? (e.code === 'LINK_INVALID' ? t('invalid') : e.message) : tc('error'));
    }
  }

  if (invalid || info?.expired || info?.used) return <p className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-900">{t('invalid')}</p>;
  if (!info) return <p className="text-sm text-slate-500">{tc('loading')}</p>;
  if (state === 'done') return <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">{t('done')}</p>;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t('heading')}</h1>
      <p className="text-sm text-slate-700">{t('intro', { name: info.displayName })}</p>
      {!supported ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{t('unsupported')}</p>
      ) : (
        <button
          onClick={() => void enrol()}
          disabled={state === 'busy'}
          className="w-full rounded-lg bg-teal-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
        >
          {t('start')}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
