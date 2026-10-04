import Link from 'next/link';
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoEmail } from '@/lib/demo-accounts';
import { serverEnv } from '@/lib/server-env';
import { LoginForm, type DemoLogin } from './login-form';

/** The same synthetic accounts as the landing page sheet (lib/demo-accounts.ts); the field app signs in at /field. */
const DEMO_LOGIN: DemoLogin = {
  password: DEMO_PASSWORD,
  accounts: DEMO_ACCOUNTS.filter((a) => !a.fieldApp).map((a) => ({ email: demoEmail(a), label: a.screen })),
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Officer sign in</h1>
        <p className="text-sm text-slate-600">For officers and staff working on land acquisition cases.</p>
      </div>
      <LoginForm demo={serverEnv.demoMode ? DEMO_LOGIN : null} />
      <p className="border-t border-slate-200 pt-4 text-sm text-slate-600">
        Not an officer? Citizens do not need an account.{' '}
        <Link href="/portal" className="font-medium text-teal-800 underline">
          Go to the public portal
        </Link>
      </p>
    </div>
  );
}
