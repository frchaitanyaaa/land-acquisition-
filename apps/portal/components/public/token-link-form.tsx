'use client';

import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { extractToken, tokenHref, type TokenPage } from '@/lib/public-links';

/**
 * Paste the SMS / QR link the office sent → open WS3's existing passbook or acknowledgement page.
 * No new authentication: the single-use token in that link is the only credential, and WS3's page
 * and the public_* functions validate it.
 */
export function TokenLinkForm({
  page,
  text,
}: {
  page: TokenPage;
  text: { label: string; placeholder: string; open: string; bad: string };
}) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState('');
  const [bad, setBad] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const token = extractToken(value);
    if (!token) {
      setBad(true);
      return;
    }
    setBad(false);
    router.push(tokenHref(page, token));
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor={id} className="block text-sm text-slate-700">
        {text.label}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={text.placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={bad || undefined}
          aria-describedby={bad ? `${id}-err` : undefined}
          className="input min-w-0 flex-1"
        />
        <button type="submit" className="rounded-md bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800">
          {text.open}
        </button>
      </div>
      {bad && (
        <p id={`${id}-err`} role="alert" className="text-sm text-red-700">
          {text.bad}
        </p>
      )}
    </form>
  );
}
