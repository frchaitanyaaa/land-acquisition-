import type { ProjectCategory } from './enums';

/** §39.1 — the full category/sub-category table. `subCategory` is stored as free text (not an
 * enum), so these are suggestions for a picker, not a validated allowlist. */
export const PROJECT_CATEGORY_LABEL: Record<ProjectCategory, string> = {
  STRATEGIC_DEFENCE: 'Strategic & Defence',
  TRANSPORT: 'Transport & Connectivity',
  ENERGY_UTILITIES: 'Energy & Utilities',
  WATER_AGRICULTURE: 'Water Management & Agriculture',
  INDUSTRIAL: 'Industrial & Commercial Zones',
  URBAN_HOUSING: 'Urban Planning & Housing',
  PUBLIC_SERVICES: 'Public Services & Infrastructure',
  PPP_CORPORATE: 'Sector-Specific PPP & Corporate',
};

export const PROJECT_SUB_CATEGORIES: Record<ProjectCategory, string[]> = {
  STRATEGIC_DEFENCE: [
    'Military bases, airfields, naval ports, ammunition dumps',
    'Border fencing, forward posts, strategic roads',
    'Defence manufacturing, nuclear test/research sites',
  ],
  TRANSPORT: [
    'Linear corridors (highways, expressways, bypasses, railway tracks, freight corridors)',
    'Mass rapid transit (metro, monorail, high-speed rail)',
    'Nodes & terminals (airports, ports, bus terminals, logistics parks)',
  ],
  ENERGY_UTILITIES: [
    'Generation (solar, hydro, thermal, nuclear)',
    'Transmission (substations, HV lines)',
    'Energy transport (oil, gas, slurry pipelines, coal mining rights)',
  ],
  WATER_AGRICULTURE: ['Reservoirs, canals, check dams', 'Water treatment, sewage, flood embankments'],
  INDUSTRIAL: ['Industrial corridors', 'NIMZs and SEZs', 'Tech parks, IT hubs, state industrial estates'],
  URBAN_HOUSING: [
    'Slum rehabilitation, affordable housing',
    'Planned expansions, townships',
    'Rehabilitation colonies',
  ],
  PUBLIC_SERVICES: [
    'Hospitals, medical colleges, universities, research institutes',
    'Waste management, parks, administrative buildings',
  ],
  PPP_CORPORATE: [
    'Government-controlled PPP (70% consent)',
    'Private company with public utility (80% consent)',
  ],
};
