import type { JurisdictionLevel, Role } from './enums';

// Field-level visibility (CLAUDE.md §11.4). Declared once here; the API applies it to every
// response (RedactionInterceptor) so restricted values never reach the browser at all.
//
// Keys are `<entity>.<dtoField>`. A DTO opts in by being tagged with its entity name
// (`tagEntity('disbursement', dto)`), so field names must match the DTO exactly.
// `<entity>.*` covers every field of that entity except `id`.

export type Visibility = {
  /** Viewer's post jurisdiction level must be one of these. */
  levels?: readonly JurisdictionLevel[];
  /** Viewer's post role must be one of these. With `levels`, both must hold. */
  roles?: readonly Role[];
  /** What a disallowed viewer gets. Default REMOVED (the key is deleted). */
  else?: 'MASKED' | 'REMOVED';
  /** Even allowed viewers only ever see the last four characters. */
  maskAlways?: 'LAST4';
  /** FIELD_OFFICER sees this field regardless of level (task-level codes only). */
  fieldOfficer?: 'TASK_LEVEL';
};

export const FIELD_VISIBILITY = {
  'disbursement.holdReason': { levels: ['DISTRICT', 'STATE', 'NATIONAL'] },
  'disbursement.holdReasonCode': { levels: ['DISTRICT', 'STATE', 'NATIONAL'], fieldOfficer: 'TASK_LEVEL' },
  'person.phone': { levels: ['DISTRICT'], else: 'MASKED' },
  'person.bankRef': { levels: ['DISTRICT'], else: 'MASKED', maskAlways: 'LAST4' },
  'affectedFamily.vulnerability': {
    levels: ['DISTRICT', 'STATE', 'NATIONAL'],
    roles: ['RNR_ADMINISTRATOR', 'RNR_COMMISSIONER'],
  },
  'objection.decidedBy': { levels: ['DISTRICT', 'STATE', 'NATIONAL'] },
  'legalCase.*': { roles: ['COLLECTOR', 'LAO', 'LEGAL_CELL', 'STATE_REVENUE', 'SUPER_ADMIN'] },
} as const satisfies Record<string, Visibility>;

export type RestrictedField = keyof typeof FIELD_VISIBILITY;

/** Who is looking. `null` is the public (no login). */
export type Viewer = { role: Role; level: JurisdictionLevel } | null;

export function isAllowed(rule: Visibility, viewer: Viewer): boolean {
  if (!viewer) return false;
  if (viewer.role === 'SUPER_ADMIN') return true;
  if (rule.fieldOfficer === 'TASK_LEVEL' && viewer.role === 'FIELD_OFFICER') return true;
  if (rule.levels && !rule.levels.includes(viewer.level)) return false;
  if (rule.roles && !rule.roles.includes(viewer.role)) return false;
  return true;
}

/** Keeps the last `keep` characters, replaces the rest with X. */
export function maskValue(value: unknown, keep: number): unknown {
  if (value === null || value === undefined) return value;
  const s = String(value);
  if (s.length <= keep) return 'X'.repeat(s.length);
  return 'X'.repeat(s.length - keep) + s.slice(-keep);
}

const ENTITY_TAG = Symbol.for('bhoomisetu.redaction.entity');

type Tagged = Record<string, unknown> & { [ENTITY_TAG]?: string };

/** Marks a DTO as `<entity>` so the redaction walker applies that entity's rules to it. */
export function tagEntity<T extends object>(entity: string, dto: T): T {
  Object.defineProperty(dto, ENTITY_TAG, { value: entity, enumerable: false });
  return dto;
}

export function entityOf(value: object): string | undefined {
  return (value as Tagged)[ENTITY_TAG];
}

const RULES_BY_ENTITY: Map<string, Array<[field: string, rule: Visibility]>> = (() => {
  const map = new Map<string, Array<[string, Visibility]>>();
  for (const [key, rule] of Object.entries(FIELD_VISIBILITY) as Array<[string, Visibility]>) {
    const dot = key.indexOf('.');
    const entity = key.slice(0, dot);
    const field = key.slice(dot + 1);
    map.set(entity, [...(map.get(entity) ?? []), [field, rule]]);
  }
  return map;
})();

/**
 * Applies one entity's rules to a plain object. Returns a copy; never mutates the input.
 * `redacted` lists the `<entity>.<field>` keys that were removed or masked.
 */
export function redactEntity(
  entity: string,
  obj: Record<string, unknown>,
  viewer: Viewer,
): { value: Record<string, unknown>; redacted: string[] } {
  const rules = RULES_BY_ENTITY.get(entity);
  if (!rules) return { value: obj, redacted: [] };

  const out: Record<string, unknown> = { ...obj };
  const redacted: string[] = [];

  for (const [field, rule] of rules) {
    const fields = field === '*' ? Object.keys(out).filter((k) => k !== 'id') : [field];
    for (const f of fields) {
      if (!(f in out)) continue;
      if (isAllowed(rule, viewer)) {
        if (rule.maskAlways === 'LAST4') out[f] = maskValue(out[f], 4);
        continue;
      }
      if (rule.else === 'MASKED') out[f] = maskValue(out[f], 2);
      else delete out[f];
      redacted.push(`${entity}.${f}`);
    }
  }
  return { value: out, redacted };
}

/**
 * Walks a response tree and redacts every tagged object in it. `leaf` lets the caller convert
 * values JSON cannot carry (the API turns bigint paise into strings here).
 */
export function redactTree(
  value: unknown,
  viewer: Viewer,
  leaf: (v: unknown) => unknown = (v) => v,
): { value: unknown; redacted: string[] } {
  const redacted = new Set<string>();

  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (v === null || typeof v !== 'object' || v instanceof Date || ArrayBuffer.isView(v)) return leaf(v);

    let obj = v as Record<string, unknown>;
    const entity = entityOf(obj);
    if (entity) {
      const r = redactEntity(entity, obj, viewer);
      r.redacted.forEach((k) => redacted.add(k));
      obj = r.value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(obj)) out[k] = walk(child);
    return out;
  };

  const result = walk(value);
  return { value: result, redacted: [...redacted].sort() };
}
