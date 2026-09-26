import { describe, expect, it } from 'vitest';
import { FIELD_VISIBILITY, redactEntity, redactTree, tagEntity, type Viewer } from '../src/redaction';

const collector: Viewer = { role: 'COLLECTOR', level: 'DISTRICT' };
const requiringBody: Viewer = { role: 'REQUIRING_BODY', level: 'PROJECT' };
const fieldOfficer: Viewer = { role: 'FIELD_OFFICER', level: 'PROJECT' };

function sampleFor(field: string): Record<string, unknown> {
  return field === '*' ? { id: 'x', caseNo: 'LAR/12/2026', status: 'filed' } : { id: 'x', [field]: '9876543210' };
}

describe('FIELD_VISIBILITY (§11.4)', () => {
  // The spec's own test: for every key, a disallowed viewer receives it redacted.
  for (const key of Object.keys(FIELD_VISIBILITY)) {
    const [entity, field] = key.split('.') as [string, string];

    for (const [name, viewer] of [
      ['public', null],
      ['requiring body at project level', requiringBody],
    ] as const) {
      it(`${key} is redacted for ${name}`, () => {
        const input = sampleFor(field);
        const { value, redacted } = redactEntity(entity, input, viewer);
        const fields = field === '*' ? Object.keys(input).filter((k) => k !== 'id') : [field];
        for (const f of fields) {
          expect(value[f], `${entity}.${f}`).not.toBe(input[f]);
          expect(redacted).toContain(`${entity}.${f}`);
        }
        expect(value.id).toBe('x');
      });
    }
  }

  it('shows holdReason to a district Collector and hides it from the public (demo beat 7)', () => {
    const dto = { id: 'd1', amountPaise: 1000n, holdReason: 'Title dispute pending in civil court' };
    expect(redactEntity('disbursement', dto, collector).value.holdReason).toBe(dto.holdReason);
    expect(redactEntity('disbursement', dto, null).value).not.toHaveProperty('holdReason');
  });

  it('gives a field officer the task-level reason code but not the reason text', () => {
    const dto = { holdReason: 'Heir dispute', holdReasonCode: 'DOCUMENT_PENDING' };
    const { value } = redactEntity('disbursement', dto, fieldOfficer);
    expect(value.holdReasonCode).toBe('DOCUMENT_PENDING');
    expect(value).not.toHaveProperty('holdReason');
  });

  it('masks phone for non-district viewers instead of removing it', () => {
    const { value } = redactEntity('person', { phone: '9812345621' }, { role: 'STATE_REVENUE', level: 'STATE' });
    expect(value.phone).toBe('XXXXXXXX21');
  });

  it('masks bank refs to the last four digits even for allowed viewers', () => {
    const { value, redacted } = redactEntity('person', { bankRef: '001234564821' }, collector);
    expect(value.bankRef).toBe('XXXXXXXX4821');
    expect(redacted).toEqual([]);
  });

  it('requires both level and role for vulnerability flags', () => {
    const dto = { vulnerability: { disability: true } };
    expect(redactEntity('affectedFamily', dto, collector).value).not.toHaveProperty('vulnerability');
    expect(redactEntity('affectedFamily', dto, { role: 'RNR_ADMINISTRATOR', level: 'DISTRICT' }).value).toHaveProperty(
      'vulnerability',
    );
  });

  it('lets SUPER_ADMIN see everything', () => {
    const { value } = redactEntity('disbursement', { holdReason: 'x' }, { role: 'SUPER_ADMIN', level: 'PROJECT' });
    expect(value.holdReason).toBe('x');
  });
});

describe('redactTree', () => {
  it('redacts tagged objects anywhere in the tree and reports what it removed', () => {
    const body = {
      family: { id: 'f1' },
      disbursements: [
        tagEntity('disbursement', { id: 'd1', amountPaise: 500000n, holdReason: 'x' }),
        tagEntity('disbursement', { id: 'd2', amountPaise: 700000n, holdReason: null }),
      ],
    };
    const { value, redacted } = redactTree(body, null, (v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(value).toEqual({
      family: { id: 'f1' },
      disbursements: [
        { id: 'd1', amountPaise: '500000' },
        { id: 'd2', amountPaise: '700000' },
      ],
    });
    expect(redacted).toEqual(['disbursement.holdReason']);
  });

  it('leaves untagged objects alone', () => {
    const body = { holdReason: 'not a disbursement DTO' };
    expect(redactTree(body, null).value).toEqual(body);
  });
});
