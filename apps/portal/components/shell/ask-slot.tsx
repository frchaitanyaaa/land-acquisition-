import Link from 'next/link';

/** "Ask AI" quick action → the analytics assistant (advisory, read-only tools under the caller's scope). */
export function AskSlot({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/assistant" onClick={onNavigate} className="ux4g-btn ux4g-btn-tonal-primary ux4g-btn-s ux4g-w-100">
      <span className="ux4g-icon-outlined" aria-hidden="true">
        auto_awesome
      </span>
      Ask AI
    </Link>
  );
}
