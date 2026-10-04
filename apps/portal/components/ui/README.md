# components/ui — shared UX4G recipes

Everyone building portal screens uses these, so all four of us produce the same look.
See them rendered at **`/ui-kit`** (light and dark).

```ts
import { KpiCard, StatusTag, SectionCard, EmptyState, MockBadge, AdvisoryBadge, NavyHero, PageHeader } from '@/components/ui';
```

The theme is decided in `prompts/team/00-shared-context.md`: navy primary and saffron secondary, overridden once in
`app/globals.css`. Never write a raw hex, `rgba()` or px value in a screen. If you need one, ask Chaitanya for a token.

## Rules that will bite you

1. **Verify every class against the CSS, not the README.** `node_modules/ux4g-web-components/README.md` lists names
   the stylesheet does not define. What actually exists:

   | README says | Use instead |
   |---|---|
   | `ux4g-btn-md`, `-sm` | `ux4g-btn-m`, `ux4g-btn-s`, `ux4g-btn-xs` |
   | `ux4g-icon-btn-md` | `ux4g-icon-btn-m` (always with the base `ux4g-icon-btn`) |
   | `ux4g-dropdown-md`, `ux4g-dropdown-item` | `ux4g-dropdown-m`, `ux4g-dropdown-option` |
   | `ux4g-switch-md`, `ux4g-filter-chip-md` | `ux4g-switch-m`, `ux4g-filter-chip-m` / `-s` |
   | `ux4g-spinner-primary-full` | `ux4g-spinner-s` / `-m` / `-l` |
   | `ux4g-flex-col`, `ux4g-d-grid` | `ux4g-flex-column`, `ux4g-grid ux4g-grid-cols-N` |
   | `ux4g-tag-tonal-brand` | `ux4g-tag-tonal-primary` (colours: neutral, primary, success, warning, error, info) |
   | `ux4g-sla-fill` | `ux4g-sla-linear-track` > `ux4g-sla-linear-fill` |
   | `ux4g-border`, `ux4g-bt` / `bb` / … | none exist; use a Card or `ux4g-border-neutral-subtle` on a component |
   | `ux4g-text-brand-primary` | `ux4g-text-primary` |

   Responsive variants put the breakpoint first: `ux4g-md-d-none`, `ux4g-md-grid-cols-2`, `ux4g-lg-grid-cols-4`
   (min-width 768 / 992). A quick check:
   `grep -c '\.ux4g-your-class[^a-z0-9-]' node_modules/ux4g-web-components/styles/ux4g.css`.

2. **Interactive components: React owns the open state.** Toggle UX4G's open classes yourself (`is-open` on
   `.ux4g-dropdown`, `show` on `.ux4g-popover`, `ux4g-drawer-open` on drawer and overlay). Don't put the runtime's
   hooks (`.ux4g-dropdown-control`, `data-ux-toggle`, `data-drawer`, `data-modal-target`) on React-controlled
   elements, or the runtime and React will toggle the same element twice. `components/shell/use-disclosure.ts` gives
   you open/close, Escape and outside-click handling.

3. **Dark mode is per route.** UX4G's dark tokens exist only at `:root`, so a section cannot be scoped back to light.
   Tailwind screens render light whatever the viewer chose. When your screen is fully UX4G, add its route to
   `DARK_READY_ROUTES` in `components/shell/prefs.ts`, then check it in dark.

4. **Known UX4G 3.0.0 quirks** (already patched in `globals.css`, but don't fight them):
   - Outlined icons were painted white everywhere. Now they follow `ux4g-icon-neutral`, `ux4g-text-primary` and similar, or inherit.
   - `--ux4g-text-white` is `#000` in dark mode, so `ux4g-text-white` is not "always white".
   - `.ux4g-topbar__wrap .ux4g-label-m-default` forces dark text in dark mode. Don't use label classes inside the
     accessibility bar.
   - Component padding (navbar, footer) beats spacing utilities. Put padding on a wrapper.

5. **Golden rules on screen:** money via `formatCrore` / `formatINR` (G9), area via `formatArea` (G10), dates from
   the API via the `@bhoomisetu/shared` formatters (G16). `<MockBadge/>` sits next to every mock-adapter value (G7).
   Risk uses `<AdvisoryBadge/>`, never "AI prediction" or a confidence %. Show actor user **and** post (G19).

## Page header

```tsx
<PageHeader
  title="Collector desk"
  subtitle="What breaches a statutory deadline on my watch?"
  crumbs={[{ label: 'National', href: '/national' }, { label: districtName, href: `/district/${districtCode}` }, { label: 'Collector desk' }]}
  actions={<button type="button" className="ux4g-btn ux4g-btn-primary ux4g-btn-s">Export</button>}
/>
```

One `h1` per page. The page header provides it.

## Navy hero banner

```tsx
<NavyHero
  eyebrow="National command centre"
  title="National land acquisition command centre"
  subtitle={`As of ${formatDateTime(data.asOf)}`}
  scope="All India · 11 projects · 1,510 parcels"
  controls={<button type="button" className="ux4g-btn ux4g-btn-outline-neutral ux4g-btn-s">Refresh</button>}
  progress={{ value: acquiredPct, label: 'Area acquired of area affected' }}
/>
```

The surface is `ux4g-bg-primary-strong` with `ux4g-text-neutral-inverse`. In dark mode it becomes a light navy with
dark text automatically.

## KPI card

```tsx
<div className="ux4g-grid ux4g-grid-cols-1 ux4g-md-grid-cols-2 ux4g-lg-grid-cols-4 ux4g-gap-m">
  <KpiCard icon="payments" label="Compensation paid" value={formatCrore(paid)}
           sub={{ text: `${formatCrore(unconfirmed)} unconfirmed`, tone: 'warning' }} href="/national#gap" />
</div>
```

Tones: `neutral | primary | success | warning | error | info`. Error means a legal consequence. Warning means
needs action or not yet confirmed.

## Status → tag colour

```tsx
<StatusTag kind="deadline" status={row.live_status} />     // SAFE green · DUE_SOON amber · BREACHED red
<StatusTag kind="entitlement" status={e.status} />          // DISBURSED amber, ACKNOWLEDGED green
<StatusTag kind="parcel" status={pp.status} />
<StatusTag kind="chain" status={verify.result} />           // ANCHORED/VERIFIED green, MISMATCH red
<StatusTag kind="stage" status={si.status} />
<StatusTag kind="project" status={p.status} />
```

The full map is in `status-tag.tsx`. Add a status there, never inline. Raw markup if you need it:
`<span className="ux4g-tag-tonal-warning ux4g-tag-s">Due soon</span>`.

## Section card

```tsx
<SectionCard id="breaches" title="Breach board" description="Top statutory deadlines, worst first"
             actions={<Link href="/deadlines" className="ux4g-text-link-m">See all</Link>}>
  …
</SectionCard>
```

## Data table + filter bar + pagination

```tsx
<div className="ux4g-d-flex ux4g-flex-column ux4g-gap-s">
  <div className="ux4g-d-flex ux4g-ai-center ux4g-gap-s ux4g-flex-wrap">
    <label className="ux4g-input-container ux4g-input-m ux4g-input-default">
      <span className="ux4g-label-s-default">Search</span>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
    </label>
    <div className="ux4g-filter-chip-group ux4g-d-flex ux4g-gap-2xs ux4g-flex-wrap" role="group" aria-label="Status">
      <button type="button" className={`ux4g-filter-chip-s${f === 'ALL' ? ' active' : ''}`} aria-pressed={f === 'ALL'}>All</button>
    </div>
  </div>
  <div className="ux4g-o-x-auto">                 {/* the table scrolls, never the page (360 px) */}
    <table className="ux4g-table ux4g-table-m ux4g-table-zebra-rows ux4g-w-100">
      <thead><tr><th scope="col">Project</th>…</tr></thead>
      <tbody>…</tbody>
    </table>
  </div>
  <nav className="ux4g-pagination-wrapper" aria-label="Pagination">
    <div className="ux4g-pagination">
      <button type="button" className="ux4g-pagination-prev" aria-label="Previous page">‹</button>
      <button type="button" className="active" aria-current="page">1</button>
      <button type="button" className="ux4g-pagination-next" aria-label="Next page">›</button>
    </div>
  </nav>
</div>
```

Use the Input container for search, not `ux4g-search-container`, which has no visible boundary (fails WCAG
1.4.11). For a select, see `SelectField` in `components/gis/ux.tsx`.

## Empty state

```tsx
<EmptyState icon="inbox" title="No returned files" description="Files returned with a reason code appear here."
            action={<Link href="/proposals" className="ux4g-btn ux4g-btn-outline-primary ux4g-btn-s">Go to proposals</Link>} />
```

## Badges

```tsx
<MockBadge />              {/* G7, next to any mock-adapter value */}
<AdvisoryBadge />          {/* "Risk score (advisory)" */}
<AdvisoryBadge label="AI suggestion" />   {/* next to ai_suggested_* values awaiting Accept (G3) */}
```

## Alerts

```tsx
<div className="ux4g-alert ux4g-alert-warning" role="note"><span>[VERIFY] …</span></div>
```

Variants: `ux4g-alert-info | -success | -warning | -error`. Put `[VERIFY]` notes in a warning alert, first on the page.

## Shell pieces you may need

- `useSelectedProject()` (`components/shell/shell-data.ts`) returns the project chosen in the top bar.
- `useMe()` returns the user and active post. `useLiveStream()` gives SSE status and subscription. `useLiveUpdates(keys)`
  refetches on `kpi.updated`.
- Sidebar entries live in `components/shell/nav-config.ts`. When your page lands, remove its `pending: true`.
- Ask AI: replace the body of `components/shell/ask-slot.tsx` (Madhav).
