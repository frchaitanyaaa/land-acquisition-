/**
 * Landing page FAQ: each of the six innovations (CLAUDE.md §2) as problem → approach → where to see it → what is
 * simulated in this prototype. Native <details>, so it works without JavaScript. Copy is kept to what the
 * prototype really does; statutory numbers stay in the rule packs (G8), so the text names sections, not periods.
 */
interface Item {
  title: string;
  question: string;
  problem: string;
  approach: string[];
  see: string;
  note?: string;
}

const ITEMS: Item[] = [
  {
    title: 'Payment acknowledgement',
    question: 'How do you know the family actually received the money?',
    problem:
      'Records mark compensation as “paid” once the office sends it. Whether it reached the right family — not a wrong account or a middleman — is never recorded.',
    approach: [
      'After each payment the family gets a link and confirms receipt on their own phone with its fingerprint or face unlock (a passkey). The fingerprint never leaves the phone; we store only the phone’s public key.',
      'No smartphone? An OTP, or an officer-attested receipt with a witness, the reason and a geo-tagged photo — always recorded.',
      '“I did not receive this” on the same page flags the payment to the Collector.',
      'Dashboards show disbursed vs acknowledged and the gap. Possession of the land stays blocked (s.38) until the family has acknowledged, or the amount is deposited with the Authority.',
    ],
    see: 'National dashboard → “Disbursed vs. acknowledged”; a project → Families & money; Possession on a parcel.',
    note: 'The treasury payment and SMS run through mock connectors, labelled MOCK.',
  },
  {
    title: 'Statutory clocks',
    question: 'How are the Act’s deadlines enforced?',
    problem:
      'The RFCTLARR Act sets hard time limits — miss the s.19 declaration and the notification is deemed rescinded; miss the award and proceedings lapse. On paper these lapse quietly.',
    approach: [
      'Every stage starts the clocks the law attaches to it, computed in Indian time, with the section and the legal consequence.',
      'A countdown on each project (“Declaration due in 34 days — s.19”); alerts go to the responsible officer, and escalate to district and then state after a breach.',
      'Forward actions are blocked once a lapse has occurred; the estimated interest owed on late payment (s.80) is shown as an estimate.',
    ],
    see: 'National dashboard → breach alerts; Project workspace → countdown; Collector desk → deadline board.',
  },
  {
    title: 'Blockchain proof',
    question: 'How can anyone prove a record was not changed later?',
    problem:
      'Someone with database access could quietly shift a boundary or alter a payment, and nobody could prove it afterwards.',
    approach: [
      'When an officer approves a record — a verified parcel, an award, a payment, an acknowledgement, possession — a fingerprint (hash) of its key fields is written to a permissioned blockchain.',
      'Anchoring runs in the background, so the app never waits for the chain.',
      '“Check” recomputes today’s fingerprint and compares it with the anchored one: Verified, or Mismatch. A proper correction creates a new version with its own proof.',
      'No names, phone numbers or bank details go on the chain.',
    ],
    see: 'Trust center → Check on any record; the public verify page (QR) needs no login.',
    note: 'The prototype runs a local test chain; the production direction is a permissioned network (Hyperledger Besu).',
  },
  {
    title: 'GIS field verification',
    question: 'How do you make sure the right land is surveyed?',
    problem:
      'Parcel boundaries come from old maps, and field reports cannot be checked — leading to disputes about what was actually acquired.',
    approach: [
      'The Talathi walks the boundary with the field app: at each corner the phone averages GPS for five seconds and takes an in-app photo.',
      'It works offline in villages without signal and syncs later.',
      'The server checks plausibility — GPS accuracy, walking speed, photo distance from the parcel, distance from the assignment — and a Tehsildar verifies.',
      'Recorded and measured areas are both kept, and a gap is flagged. The map also flags irrigated multi-crop land (s.10) and Scheduled Areas (s.41).',
    ],
    see: 'Field app (/field) on a phone; GIS map; Tehsildar → Field office.',
    note: 'A web app cannot detect fake-GPS apps on a phone; that is why the server checks plausibility instead.',
  },
  {
    title: 'Rule packs',
    question: 'What happens when the law or a state rule changes?',
    problem:
      'Laws are amended, states add their own rules, and some projects run under other Acts. Software with the law hard-coded must be rewritten — and old cases get mixed with new rules.',
    approach: [
      'The Act and each state’s rules are stored as versioned data: stages, deadlines, checks and entitlement heads.',
      'Every project is pinned to the version it started under, so a later change never rewrites an ongoing case.',
      'The same engine runs a different statute — a sample National Highways Act pack shows it.',
    ],
    see: 'Rule packs page (footer) — compare the Maharashtra pack with the National Highways pack.',
    note: 'The National Highways pack is an illustrative sample.',
  },
  {
    title: 'AI assistant',
    question: 'Can AI make decisions on land or money?',
    problem:
      'Officers and oversight need fast answers across many projects, but AI must never decide ownership, possession or compensation.',
    approach: [
      'Plain-language questions are answered by calling fixed, read-only analytics tools — under the asking officer’s own data access. It never writes database queries and has no tool that changes a record.',
      'Answers show the numbers they came from.',
      'OCR reads a signed award PDF and suggests each amount; the officer accepts every value one by one. AI suggestions are stored separately and become official only through a human action.',
    ],
    see: '“Ask AI” in the sidebar; Award → upload an award PDF.',
    note: 'In this demo the assistant runs in mock mode with scripted answers.',
  },
];

export function InnovationFaq() {
  return (
    <section aria-labelledby="faq-title" className="mx-auto max-w-4xl">
      <h2 id="faq-title" className="text-center text-2xl font-bold text-slate-950">
        How BhoomiSetu solves it
      </h2>
      <p className="mt-1 text-center text-sm text-slate-600">Six innovations — tap one to see the problem and our answer.</p>
      <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {ITEMS.map((it, i) => (
          <details key={it.title} id={`innovation-${i + 1}`} className="group scroll-mt-24">
            <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              <span className="text-2xl font-black leading-none text-[#ff9933]" aria-hidden>
                {i + 1}
              </span>
              <span className="flex-1">
                <span className="block font-semibold text-slate-950">{it.title}</span>
                <span className="block text-sm text-slate-600">{it.question}</span>
              </span>
              <span className="text-xl text-slate-400 transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <div className="space-y-3 px-5 pb-5 pl-14 text-sm leading-relaxed text-slate-700">
              <p>
                <span className="font-semibold text-slate-950">The problem. </span>
                {it.problem}
              </p>
              <div>
                <p className="font-semibold text-slate-950">How we solve it</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {it.approach.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <p>
                <span className="font-semibold text-slate-950">See it in the app. </span>
                {it.see}
              </p>
              {it.note && (
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-semibold">In this prototype: </span>
                  {it.note}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
