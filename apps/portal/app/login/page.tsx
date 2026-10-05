import Link from 'next/link';
import { serverEnv } from '@/lib/server-env';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md py-6">
      <div className="text-center">
        <span className="ux4g-icon-outlined text-5xl" style={{ color: '#1f3c8f' }} aria-hidden>
          admin_panel_settings
        </span>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Officer login</h1>
        <p className="mt-1 text-sm text-slate-600">
          For government officers working on land acquisition — Revenue, LAO / CALA, Collectorate and requiring bodies.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <LoginForm demo={serverEnv.demoMode} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-600">
        Citizen or landowner? No account needed —{' '}
        <Link href="/portal" className="font-semibold text-[#138808] hover:underline">
          Public Land Information Portal →
        </Link>
      </p>
    </div>
  );
}
