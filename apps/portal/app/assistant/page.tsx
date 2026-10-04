'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { api, ApiProblem, type Me } from '@/lib/api';
import { jurisdictionText, roleLabel } from '@/lib/roles';

/** Response of POST /assistant/query (apps/api/src/assistant/assistant.service.ts). */
interface ToolCallLog {
  tool: string;
  input: unknown;
  output: unknown;
}
interface AssistantAnswer {
  answer: string;
  toolCalls: ToolCallLog[];
  provider: 'MOCK' | 'REAL';
  note?: string;
}

interface Turn {
  id: number;
  question: string;
  result?: AssistantAnswer;
  error?: string;
}

const MIN_Q = 3; // API validation: question 3..2000 characters
const MAX_Q = 2000;
const MAX_JSON = 6000;

/** Phrased so the deterministic mock provider (LLM_PROVIDER=mock) recognises each one. */
const SUGGESTED = [
  'Which statutory deadlines are breached or due soon?',
  'What is the gap between compensation disbursed and acknowledged by families?',
  'Which stages are the bottlenecks where files are stuck?',
  'Rank districts by breached deadlines.',
  'Give me an overview of the key figures in my scope.',
];

function errorMessage(err: unknown): string {
  if (err instanceof ApiProblem) {
    if (err.status === 502 || err.code === 'LLM_UNAVAILABLE')
      return 'The language model is not reachable right now, so no answer was produced and nothing was changed. Try again later. The deterministic mock provider (LLM_PROVIDER=mock) works without a model.';
    if (err.status === 429) return 'Too many questions in a short time. Wait a minute and ask again.';
    if (err.status === 403) return 'Your active post is not allowed to use the assistant.';
    return err.message || 'The assistant could not answer this question.';
  }
  return 'Could not reach the server.';
}

function pretty(value: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    s = String(value);
  }
  return s.length > MAX_JSON ? `${s.slice(0, MAX_JSON)}\n… (truncated)` : s;
}

/**
 * AI assistant (CLAUDE.md §24.5). Advisory only (G3): the API exposes read-only tools that run under
 * the caller's active post scope, and this page has no action that changes a record. Answers are
 * shown as plain text, never rendered as HTML.
 */
export default function AssistantPage() {
  const router = useRouter();
  const questionId = useId();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    api<Me>('/auth/me')
      .then(setMe)
      .catch((err: unknown) => {
        if (err instanceof ApiProblem && err.status === 401) router.replace('/login');
        else setLoadError('Could not load your session.');
      });
  }, [router]);

  const ask = useMutation({
    mutationFn: (q: string) =>
      api<AssistantAnswer>('/assistant/query', { method: 'POST', body: JSON.stringify({ question: q }) }),
  });

  function send(q: string) {
    const text = q.trim();
    if (text.length < MIN_Q || ask.isPending) return;
    const id = nextId.current++;
    setTurns((prev) => [{ id, question: text }, ...prev]);
    setQuestion('');
    ask.mutate(text, {
      onSuccess: (result) => setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, result } : x))),
      onError: (err) => {
        if (err instanceof ApiProblem && err.status === 401) {
          router.replace('/login');
          return;
        }
        setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, error: errorMessage(err) } : x)));
      },
    });
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(question);
  }

  if (loadError) return <p className="text-red-700">{loadError}</p>;
  if (!me) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Analytics assistant</h1>
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
          <p className="font-semibold">Advisory only</p>
          <p className="mt-1">
            The assistant reads figures through read-only tools and cannot change any record. It sees only what your
            active post sees: {me.activePost.designation} ({roleLabel(me.activePost.role)}, {jurisdictionText(me.activePost)}).
            Check figures on the dashboards before acting on them; decisions stay with the officer.
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label htmlFor={questionId} className="block text-sm text-slate-700">
          Your question
        </label>
        <textarea
          id={questionId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(question);
            }
          }}
          rows={3}
          maxLength={MAX_Q}
          placeholder="For example: which deadlines are breached in my district?"
          className="input"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={ask.isPending || question.trim().length < MIN_Q}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {ask.isPending ? 'Asking…' : 'Ask'}
          </button>
          <span className="text-xs text-slate-500">
            Enter to ask, Shift+Enter for a new line. Each question is answered on its own; earlier questions are not
            remembered.
          </span>
        </div>
      </form>

      <section aria-labelledby="suggested">
        <h2 id="suggested" className="text-sm font-semibold text-slate-700">
          Try a question
        </h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => send(s)}
                disabled={ask.isPending}
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-800 hover:bg-slate-100 disabled:opacity-60"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-live="polite" className="space-y-4">
        {turns.map((turn) => (
          <article key={turn.id} className="rounded-lg border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-4 py-3 font-medium text-slate-900">{turn.question}</p>
            <div className="space-y-3 px-4 py-3">
              {!turn.result && !turn.error && <p className="text-sm text-slate-500">Working…</p>}
              {turn.error && (
                <p role="alert" className="text-sm text-red-700">
                  {turn.error}
                </p>
              )}
              {turn.result && <AnswerBody result={turn.result} />}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function AnswerBody({ result }: { result: AssistantAnswer }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {result.provider === 'MOCK' ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 ring-1 ring-amber-300">MOCK</span>
        ) : (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Language model</span>
        )}
        <span className="text-xs text-slate-500">Advisory answer</span>
      </div>
      {/* Plain text only: React escapes it; never dangerouslySetInnerHTML. */}
      <p className="whitespace-pre-wrap text-slate-900">{result.answer}</p>
      {result.note && <p className="text-xs text-slate-500">{result.note}</p>}
      <details className="rounded-md border border-slate-200 bg-slate-50">
        <summary className="cursor-pointer px-3 py-2 text-sm text-slate-700">
          Sources: {result.toolCalls.length} tool call{result.toolCalls.length === 1 ? '' : 's'}
        </summary>
        {result.toolCalls.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-slate-600">No tool was called, so this answer is not backed by data.</p>
        ) : (
          <ol className="space-y-3 px-3 pb-3">
            {result.toolCalls.map((c, i) => (
              <li key={`${c.tool}-${i}`} className="space-y-1">
                <p className="text-sm font-medium text-slate-800">
                  {i + 1}. <code>{c.tool}</code>
                </p>
                <p className="text-xs text-slate-500">Input</p>
                <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-xs text-slate-800">{pretty(c.input)}</pre>
                <p className="text-xs text-slate-500">Output</p>
                <pre className="max-h-64 overflow-auto rounded bg-white p-2 text-xs text-slate-800">{pretty(c.output)}</pre>
              </li>
            ))}
          </ol>
        )}
      </details>
    </>
  );
}
