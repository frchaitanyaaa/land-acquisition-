import { describe, expect, it } from 'vitest';
import { hearingValidity } from '../src/hearing';

const ok = {
  scheduledAt: new Date('2026-12-31T05:00:00Z'),
  noticePublishedAt: new Date('2026-12-10T05:00:00Z'),
  localLanguageSummaryDocumentId: 'a',
  recordingDocumentId: 'b',
  attendanceDocumentId: 'c',
  quorumMet: true,
};

describe('hearingValidity (§17)', () => {
  it('valid with 21 days notice and all evidence', () =>
    expect(hearingValidity(ok)).toEqual({ valid: true, failures: [] }));
  it('20 days notice is inadequate', () => {
    const r = hearingValidity({ ...ok, noticePublishedAt: new Date('2026-12-11T05:00:00Z') });
    expect(r.failures.map((f) => f.code)).toEqual(['INADEQUATE_NOTICE']);
  });
  it('every missing element is reported with its reason code', () => {
    const r = hearingValidity({
      ...ok,
      noticePublishedAt: null,
      localLanguageSummaryDocumentId: null,
      recordingDocumentId: null,
      attendanceDocumentId: null,
      quorumMet: false,
    });
    expect(r.failures.map((f) => f.code)).toEqual([
      'INADEQUATE_NOTICE',
      'NO_LOCAL_LANGUAGE_SUMMARY',
      'NO_VIDEO_RECORDING',
      'ATTENDANCE_NOT_RECORDED',
      'NO_QUORUM',
    ]);
  });
});
