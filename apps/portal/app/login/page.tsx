import Link from 'next/link';
import { serverEnv } from '@/lib/server-env';
import { LoginForm, type DemoLogin } from './login-form';

/** The synthetic seed accounts already listed on this page (README: password `bhoomisetu-demo`). */
const DEMO_LOGIN: DemoLogin = {
  password: 'bhoomisetu-demo',
  accounts: [
    'oversight@bhoomisetu.local',
    'collector.pune@bhoomisetu.local',
    'lao.satara@bhoomisetu.local',
    'talathi.khedshivapur@bhoomisetu.local',
    'demo@bhoomisetu.local',
    'admin@bhoomisetu.local',
  ],
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Officer sign in</h1>
        <p className="text-sm text-slate-600">For officers and staff working on land acquisition cases.</p>
      </div>
      <LoginForm demo={serverEnv.demoMode ? DEMO_LOGIN : null} />
      {serverEnv.demoMode && (
        <aside className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-semibold">Demo accounts (synthetic)</p>
          <p className="mt-1">
            <code>demo@bhoomisetu.local</code> holds several posts for the role switcher. Password for every account:{' '}
            <code>bhoomisetu-demo</code>.{' '}
            <Link href="/#evaluator-logins" className="font-medium underline">
              All demo accounts by dashboard
            </Link>
          </p>
        </aside>
      )}
      <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">
        Not an officer? Citizens do not need an account.{' '}
        <Link href="/portal" className="font-medium text-teal-800 underline">
          Go to the public portal
        </Link>
      </p>
    </div>
  );
}
