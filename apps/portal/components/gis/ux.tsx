'use client';

import type { ReactNode } from 'react';

// UX4G building blocks for the GIS screens. Every class here was checked against
// node_modules/ux4g-web-components/styles/ux4g.css (3.0.0) — the README's quick table lists some
// names (-sm/-md sizes, ux4g-dropdown-selection, ux4g-radio-control on checkboxes) that the CSS
// does not define. Sizes that exist: -s / -m / -l. Swap for Chaitanya's components/ui recipes
// once they land; the markup is the same.

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export function Tag({ tone = 'neutral', children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={`ux4g-tag-tonal-${tone} ux4g-tag-s`} title={title}>
      {children}
    </span>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  allLabel = 'All',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  allLabel?: string | null;
}) {
  return (
    <label className="ux4g-input-container ux4g-input-m ux4g-input-default block">
      <span className="ux4g-label-s-default">{label}</span>
      <span className="ux4g-dropdown ux4g-dropdown-m ux4g-dropdown-default block">
        <select className="ux4g-dropdown-control w-full" value={value} onChange={(e) => onChange(e.target.value)}>
          {allLabel !== null && <option value="">{allLabel}</option>}
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="ux4g-input-container ux4g-input-m ux4g-input-default block">
      <span className="ux4g-label-s-default">{label}</span>
      <input className="ux4g-input w-full" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ux4g-checkbox ux4g-checkbox-m">
      <input type="checkbox" className="ux4g-checkbox-input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ux4g-checkbox-control">
        <span className="ux4g-checkmark" />
      </span>
      <span className="ux4g-checkbox-content">{label}</span>
    </label>
  );
}

export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ux4g-switch ux4g-switch-s flex">
      <input type="checkbox" className="ux4g-switch-input" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="ux4g-switch-control">
        <span className="ux4g-switch-track">
          <span className="ux4g-switch-thumb" />
        </span>
      </span>
      <span className="ux4g-switch-content">{label}</span>
    </label>
  );
}

/** Underline tabs. `active` is the selected key. */
export function Tabs<K extends string>({ tabs, active, onChange, label }: { tabs: Array<[K, string]>; active: K; onChange: (k: K) => void; label: string }) {
  return (
    <div className="ux4g-tab ux4g-tab-underline ux4g-tab-m">
      <div className="ux4g-tab-list" role="tablist" aria-label={label}>
        {tabs.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={active === k} className={`ux4g-tab-item ${active === k ? 'active' : ''}`} onClick={() => onChange(k)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export const riskTone = (level: string): Tone => (level === 'HIGH' ? 'error' : level === 'MEDIUM' ? 'warning' : 'neutral');
export const statusTone = (status: string): Tone =>
  /POSSESS|ACQUIRED|VERIFIED/.test(status) ? 'success' : /DISPUT|STAY|EXCLUDED/.test(status) ? 'error' : /PENDING|PROPOSED/.test(status) ? 'warning' : 'info';
