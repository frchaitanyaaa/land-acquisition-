import { DateTime, Duration } from 'luxon';
import { STATUTORY_TZ } from './engine/time';

// Hearing validity (§17). [VERIFY] the advance-notice period: three weeks is taken from the SIA
// rules as summarised in our process documents. It lives here (packages/rules) so no business code
// carries it (G8); move it into a pack version when the rule packs gain a `hearings` section.
export const HEARING_NOTICE_MIN = 'P21D';

export interface HearingFacts {
  scheduledAt: Date;
  noticePublishedAt: Date | null;
  localLanguageSummaryDocumentId: string | null;
  recordingDocumentId: string | null;
  attendanceDocumentId: string | null;
  quorumMet: boolean | null;
}

export interface HearingValidity {
  valid: boolean;
  /** Failures carry the pack's HEARING reason codes so a NULLIFY can cite them. */
  failures: Array<{ code: string; message: string }>;
}

export function hearingValidity(h: HearingFacts, tz: string = STATUTORY_TZ): HearingValidity {
  const failures: HearingValidity['failures'] = [];
  const latestNotice = DateTime.fromJSDate(h.scheduledAt, { zone: tz })
    .minus(Duration.fromISO(HEARING_NOTICE_MIN))
    .endOf('day');
  if (!h.noticePublishedAt || DateTime.fromJSDate(h.noticePublishedAt, { zone: tz }) > latestNotice) {
    failures.push({
      code: 'INADEQUATE_NOTICE',
      message: 'Notice must be published at least three weeks before the hearing',
    });
  }
  if (!h.localLanguageSummaryDocumentId)
    failures.push({ code: 'NO_LOCAL_LANGUAGE_SUMMARY', message: 'Local-language summary not uploaded' });
  if (!h.recordingDocumentId) failures.push({ code: 'NO_VIDEO_RECORDING', message: 'Recording not uploaded' });
  if (!h.attendanceDocumentId)
    failures.push({ code: 'ATTENDANCE_NOT_RECORDED', message: 'Attendance register not uploaded' });
  if (h.quorumMet !== true) failures.push({ code: 'NO_QUORUM', message: 'Quorum not recorded as met' });
  return { valid: failures.length === 0, failures };
}
