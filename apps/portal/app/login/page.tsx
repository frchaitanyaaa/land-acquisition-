import { serverEnv } from '@/lib/server-env';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <LoginForm />
      {serverEnv.demoMode && (
        <aside className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-semibold">Demo accounts (synthetic)</p>
          <p className="mt-1">
            <code>demo@bhoomisetu.local</code> holds several posts for the role switcher. Officers:{' '}
            <code>collector.pune@</code>, <code>collector.nagpur@</code>, <code>lao.pune@</code>, <code>admin@</code> …
            <code>bhoomisetu.local</code>. Password: <code>bhoomisetu-demo</code>.
          </p>
        </aside>
      )}
    </div>
  );
}
