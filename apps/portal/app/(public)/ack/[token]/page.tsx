'use client';

import { startAuthentication } from '@simplewebauthn/browser';
import { useLocale, useTranslations } from 'next-intl';
import { use, useCallback, useEffect, useState } from 'react';
import { dateIST, rupees } from '@/components/public/format';
import { ApiProblem } from '@/lib/api';
import { publicApi, type AckInfo } from '@/lib/public-api';

type Done = 'acknowledged' | 'disputed' | null;

/**
 * /ack/:token — opened on the BENEFICIARY'S OWN phone (§21.2). "Did you receive this amount?"
 * Confirm with the phone's fingerprint/face (WebAuthn), or an SMS code, or report non-receipt.
 * Works with no officer session; shows the payment and never why anything was held (§11.4).
 */
export default function AckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations();
  const locale = useLocale();
  const [info, setInfo] = useState<AckInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [done, setDone] = useState<Done>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState<{ demoOtp?: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    publicApi<AckInfo>(`/ack/${token}`)
      .then(setInfo)
      .catch(() => setLoadError(true));
  }, [token]);
  useEffect(load, [load]);

  const explain = (e: unknown) => {
    if (e instanceof ApiProblem) {
      if (e.code === 'LINK_INVALID') return t('ack.invalid');
      if (e.code === 'NOT_PAID_YET') return t('ack.notPaid');
      if (e.code === 'NO_PASSKEY') return t('ack.noPasskey');
      return e.message;
    }
    if (e instanceof Error && e.name === 'NotAllowedError') return null; // user cancelled the prompt
    return t('common.error');
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(explain(e));
    } finally {
      setBusy(false);
    }
  }

  const withPasskey = () =>
    run(async () => {
      const optionsJSON = await publicApi<Parameters<typeof startAuthentication>[0]['optionsJSON']>(`/ack/${token}/options`);
      const response = await startAuthentication({ optionsJSON });
      await publicApi(`/ack/${token}/verify`, { method: 'POST', body: JSON.stringify({ response }) });
      setDone('acknowledged');
    });

  const sendOtp = () =>
    run(async () => {
      setOtpSent(await publicApi<{ sent: boolean; demoOtp?: string }>(`/ack/${token}/otp/send`, { method: 'POST' }));
    });

  const verifyOtp = () =>
    run(async () => {
      await publicApi(`/ack/${token}/otp/verify`, { method: 'POST', body: JSON.stringify({ otp }) });
      setDone('acknowledged');
    });

  const dispute = () =>
    run(async () => {
      await publicApi(`/ack/${token}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) });
      setDone('disputed');
    });

  if (loadError) return <Message tone="bad">{t('ack.invalid')}</Message>;
  if (!info) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (done === 'acknowledged') return <Message tone="good">{t('ack.done')}</Message>;
  if (done === 'disputed') return <Message tone="good">{t('ack.disputed')}</Message>;
  if (info.expired || info.used) return <Message tone="bad">{info.acknowledged ? t('ack.already') : t('ack.invalid')}</Message>;
  if (info.acknowledged) return <Message tone="good">{t('ack.already')}</Message>;

  const paid = info.paymentStatus === 'PAID';
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t('ack.heading')}</h1>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-600">{info.recipientFirstName}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{rupees(info.amountPaise)}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-slate-500">{t('common.head')}</dt>
          <dd>{info.headCode.replace(/_/g, ' ')}</dd>
          <dt className="text-slate-500">{t('common.project')}</dt>
          <dd>
            {info.projectName} ({info.projectCode})
          </dd>
          <dt className="text-slate-500">{t('common.status')}</dt>
          <dd>{paid ? t('ack.paid') : t('ack.inProcess')}</dd>
          <dt className="text-slate-500">{t('common.paidOn')}</dt>
          <dd>{dateIST(info.paidOn, locale)}</dd>
        </dl>
      </div>

      {paid && (
        <>
          <p className="text-lg font-medium">{t('ack.question')}</p>
          <div className="space-y-3">
            {info.canUsePasskey && (
              <button
                onClick={() => void withPasskey()}
                disabled={busy}
                className="w-full rounded-lg bg-teal-700 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
              >
                {t('ack.confirmPasskey')}
              </button>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              {!otpSent ? (
                <button onClick={() => void sendOtp()} disabled={busy} className="w-full text-left text-sm font-medium text-teal-800">
                  {t('ack.confirmOtp')} →
                </button>
              ) : (
                <div className="space-y-2">
                  {otpSent.demoOtp && <p className="text-xs text-amber-800">{t('ack.demoOtp', { otp: otpSent.demoOtp })}</p>}
                  <label className="block text-sm">
                    <span className="text-slate-700">{t('ack.otpLabel')}</span>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-lg tracking-widest"
                    />
                  </label>
                  <button
                    onClick={() => void verifyOtp()}
                    disabled={busy || otp.length !== 6}
                    className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {t('ack.verifyOtp')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="rounded-lg border border-red-200 bg-white p-4">
        {!disputing ? (
          <button onClick={() => setDisputing(true)} className="text-sm font-medium text-red-700">
            {t('ack.notReceived')}
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="text-slate-700">{t('ack.disputeReason')}</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={2000} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <button
              onClick={() => void dispute()}
              disabled={busy || reason.trim().length < 3}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('ack.sendDispute')}
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

function Message({ tone, children }: { tone: 'good' | 'bad'; children: string }) {
  return (
    <p className={`rounded-lg border p-5 text-base ${tone === 'good' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-red-200 bg-red-50 text-red-900'}`}>
      {children}
    </p>
  );
}
