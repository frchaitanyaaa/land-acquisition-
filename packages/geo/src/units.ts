// Area is stored in square metres (G10); these convert for display only (CLAUDE.md §9).

export const SQM_PER_HECTARE = 10_000;
export const SQM_PER_ACRE = 4046.8564224;
/** 1/40 acre, used in Maharashtra. */
export const SQM_PER_GUNTHA = 101.17141056;

export const sqmToHectares = (sqm: number) => sqm / SQM_PER_HECTARE;
export const sqmToAcres = (sqm: number) => sqm / SQM_PER_ACRE;
export const sqmToGunthas = (sqm: number) => sqm / SQM_PER_GUNTHA;

/** `2.37 ha · 5.86 acre · 234.3 guntha` */
export function formatArea(sqm: number): string {
  return [
    `${sqmToHectares(sqm).toFixed(2)} ha`,
    `${sqmToAcres(sqm).toFixed(2)} acre`,
    `${sqmToGunthas(sqm).toFixed(1)} guntha`,
  ].join(' · ');
}
