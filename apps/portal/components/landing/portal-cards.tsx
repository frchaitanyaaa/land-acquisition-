import Link from 'next/link';

const OFFICER = ['Project monitoring', 'GIS land records and field verification', 'Statutory deadline alerts', 'Compensation and acknowledgement tracking', 'AI decision support'];
const PUBLIC = ['Search land by village and survey number', 'Track acquisition status', 'Notices and orders', 'Objections and grievances'];

function Card({
  icon,
  tone,
  badge,
  title,
  audience,
  body,
  points,
  href,
  cta,
}: {
  icon: string;
  tone: 'navy' | 'green';
  badge: string;
  title: string;
  audience: string;
  body: string;
  points: string[];
  href: string;
  cta: string;
}) {
  const c =
    tone === 'navy'
      ? { fg: '#1f3c8f', soft: 'bg-[#eef2fb]', btn: 'bg-[#1f3c8f] hover:bg-[#182f72]', dot: 'bg-[#1f3c8f]' }
      : { fg: '#138808', soft: 'bg-[#e9f6e7]', btn: 'bg-[#138808] hover:bg-[#0f6e06]', dot: 'bg-[#138808]' };
  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-start justify-between">
        <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${c.soft}`}>
          <span className="ux4g-icon-outlined text-3xl" style={{ color: c.fg }} aria-hidden>
            {icon}
          </span>
        </span>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${c.soft}`} style={{ color: c.fg }}>
          {badge}
        </span>
      </div>
      <h2 className="mt-5 text-2xl font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider" style={{ color: c.fg }}>
        {audience}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{body}</p>
      <ul className="mt-4 flex-1 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-sm text-slate-800">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} aria-hidden />
            {p}
          </li>
        ))}
      </ul>
      <Link href={href} className={`mt-6 flex items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white ${c.btn}`}>
        {cta} →
      </Link>
    </article>
  );
}

/** The two ways in (landing page): officers sign in by role; citizens use the open portal, no account. */
export function PortalCards({ demoMode }: { demoMode: boolean }) {
  return (
    <section id="portals" aria-label="Choose a portal" className="scroll-mt-24">
      <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
        <Card
          icon="admin_panel_settings"
          tone="navy"
          badge="Restricted"
          title="Officer Portal"
          audience="For government officers"
          body="Monitor projects, verify land parcels, act on statutory deadlines and track compensation until the family confirms it."
          points={OFFICER}
          href="/login"
          cta="Officer login"
        />
        <Card
          icon="travel_explore"
          tone="green"
          badge="Open access"
          title="Public Land Information Portal"
          audience="For citizens and landowners"
          body="Find your land, follow the acquisition, read published notices and raise an objection or grievance — no account needed."
          points={PUBLIC}
          href="/portal"
          cta="Enter public portal"
        />
      </div>
      {demoMode && (
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo: on the officer login, choose any role — its synthetic account fills in by itself.
        </p>
      )}
    </section>
  );
}
