import { useState } from 'react';
import { Camera, type Capture } from '../components/Camera';
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui';
import { usePosition } from '../lib/position';
import { go } from '../lib/router';
import { savePhoto, saveNotice } from '../lib/survey';
import { PhotoThumb } from './PhotoThumb';
import type { SurveyProps } from './SurveyShell';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * §16.2 screen 5 — s.12 notice: date served + photo of the notice. The notice is a legal document,
 * so the officer attests it at upload (G21) — the server refuses it otherwise.
 */
export function Notice({ survey }: SurveyProps) {
  usePosition(); // keep GPS warm for the photo's location
  const editable = survey.status === 'draft';
  const [servedOn, setServedOn] = useState(survey.notice?.servedOn ?? today());
  const [attest, setAttest] = useState(!!survey.notice);
  const [camera, setCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(c: Capture) {
    const photoLocalId = await savePhoto({
      surveyClientId: survey.clientId,
      projectId: survey.projectId,
      kind: 'S12_NOTICE_OF_ENTRY',
      blob: c.blob,
      fix: c.fix,
      capturedAt: c.capturedAt,
      attest: true,
    });
    await saveNotice(survey.clientId, servedOn, photoLocalId);
    setCamera(false);
  }

  async function saveDateOnly() {
    if (survey.notice) await saveNotice(survey.clientId, servedOn, survey.notice.photoLocalId);
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">Notice under section 12</h2>
        <Field label="Date served">
          <input
            type="date"
            value={servedOn}
            max={today()}
            disabled={!editable}
            onChange={(e) => setServedOn(e.target.value)}
            onBlur={saveDateOnly}
            className={inputClass}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={attest} disabled={!editable} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
          <span>I attest that the photo I take is of the notice actually served on this date.</span>
        </label>
        {survey.notice && (
          <div className="flex items-center gap-3">
            <PhotoThumb localId={survey.notice.photoLocalId} className="h-24 w-24" />
            <p className="text-sm text-emerald-800">Notice recorded for {survey.notice.servedOn}.</p>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
        {editable && (
          <Button
            disabled={!servedOn}
            onClick={() => (attest ? setCamera(true) : setError('Tick the attestation first.'))}
            className="w-full"
          >
            {survey.notice ? 'Retake notice photo' : 'Photograph the notice'}
          </Button>
        )}
      </Card>
      <Button variant="ghost" className="w-full" onClick={() => go(`survey/${survey.clientId}/jir`)}>
        Next: joint inspection →
      </Button>
      {camera && <Camera title="s.12 notice" onCapture={onPhoto} onCancel={() => setCamera(false)} />}
    </div>
  );
}
