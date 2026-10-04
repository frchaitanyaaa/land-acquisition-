import Link from 'next/link';

/** UX4G Footer, dark theme. Provenance line is the same idea as the public portal's (§25). */
export function Footer() {
  return (
    <footer className="ux4g-footer-wrapper ux4g-footer-dark ux4g-px-m ux4g-py-m">
      <div className="ux4g-footer-row ux4g-ai-center ux4g-gap-m ux4g-flex-wrap">
        <p className="ux4g-body-s-default">
          BhoomiSetu · Prototype · synthetic demo data · SIH 26016 · Ministry of Rural Development
        </p>
        <nav aria-label="Footer" className="ux4g-d-flex ux4g-gap-m ux4g-flex-wrap">
          <Link href="/rule-packs" className="ux4g-text-link-inverse ux4g-body-s-default">
            Rule packs
          </Link>
          <Link href="/public" className="ux4g-text-link-inverse ux4g-body-s-default">
            Public portal
          </Link>
          <a href="/api/docs" className="ux4g-text-link-inverse ux4g-body-s-default">
            API reference
          </a>
        </nav>
      </div>
      <p className="ux4g-body-xs-default ux4g-pt-s ux4g-pb-xs">
        Figures are recorded by the concerned authority; adapter values marked MOCK are not live
        government integrations.
      </p>
    </footer>
  );
}
