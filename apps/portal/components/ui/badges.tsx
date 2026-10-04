/**
 * G7: every value that came from a mock adapter (payment, identity, cadastral, SMS, LLM, STT)
 * carries this badge. Put it right next to the value, not in a footnote.
 */
export function MockBadge({ provider = 'MOCK' }: { provider?: string }) {
  return (
    <span className="ux4g-tag-tonal-warning ux4g-tag-s" title="From a mock adapter — not a live government integration">
      {provider}
    </span>
  );
}

/**
 * Risk scores are a transparent heuristic (§24.4), never "AI prediction" and never a confidence %.
 * Use next to every risk score and AI suggestion (G3 — the officer decides).
 */
export function AdvisoryBadge({ label = 'Risk score (advisory)' }: { label?: string }) {
  return (
    <span className="ux4g-tag-tonal-info ux4g-tag-s" title="Advisory only — an officer decides">
      {label}
    </span>
  );
}

/** G18: synthetic data marker for pages outside the shell (the shell's top bar already has one). */
export function DemoDataBadge() {
  return (
    <span className="ux4g-tag-filled-warning ux4g-tag-s" title="All records are synthetic demo data">
      DEMO DATA
    </span>
  );
}
