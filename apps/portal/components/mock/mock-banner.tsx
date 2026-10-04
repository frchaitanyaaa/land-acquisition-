/** Shown on every screen backed by lib/mock-citizen.ts (G7: mocks are labelled, never presented as real). */
export function MockBanner({ what = 'This screen' }: { what?: string }) {
  return (
    <div role="note" className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-bold tracking-wide">MOCK</span>
      <p>
        <strong>Demo only.</strong> {what} runs in your browser to show the intended flow. Nothing is sent to any
        office or stored on a server, and every record is synthetic.
      </p>
    </div>
  );
}
