import { useState } from 'react';
import { Button, Card, ErrorText } from '../components/ui';
import { db } from '../lib/db';
import { computeLocalFlags, estimateAreaSqm, formatArea } from '../lib/geo';
import { useLive } from '../lib/live';
import { go } from '../lib/router';
import { queueSurvey, surveyVertices } from '../lib/survey';
import { requestBackgroundSync, syncNow } from '../lib/sync-trigger';
import type { SurveyProps } from './SurveyShell';

/** §16.2 screens 7–8 — summary + locally computed flags, then Submit (= queue for sync). */
export function Review({ survey, pack }: SurveyProps) {
  const data = useLive(async () => {
    const [vertices, jir, pillars] = await Promise.all([
      surveyVertices(survey.clientId),
      db.jirItems.where('surveyClientId').equals(survey.clientId).count(),
      db.pillars.where('surveyClientId').equals(survey.clientId).count(),
    ]);
    return { vertices, jir, pillars };
  }, [survey.clientId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  const { vertices, jir, pillars } = data;
  const local = computeLocalFlags(vertices, pack.thresholds, pack.footprint);
  const areaSqm = estimateAreaSqm(vertices);
  const blocking = [...local.blocking, ...(!survey.closed ? ['Close the polygon on Walk & Mark first.'] : [])];
  const draft = survey.status === 'draft';

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await queueSurvey(survey.clientId, local.flags);
      await requestBackgroundSync();
      if (navigator.onLine) void syncNow();
      go('sync');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue the survey.');
      setBusy(false);
    }
  }

  const flagEntries = Object.entries(local.flags);
  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-1 text-sm">
        <h2 className="mb-1 font-semibold">Summary</h2>
        <Row k="Boundary points" v={`${vertices.length} (${local.usable} usable)`} />
        <Row k="Area (estimate)" v={areaSqm != null ? formatArea(areaSqm) : '—'} />
        <Row k="Polygon" v={survey.closed ? 'closed' : 'open'} />
        <Row k="s.12 notice" v={survey.notice ? `served ${survey.notice.servedOn}` : 'not recorded'} />
        <Row k="JIR items" v={String(jir)} />
        <Row k="Pillars" v={String(pillars)} />
        <Row k="Walked track" v={`${survey.track.length} points`} />
      </Card>

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">Checks (computed on this device)</h2>
        {flagEntries.length === 0 ? (
          <p className="text-emerald-800">No flags.</p>
        ) : (
          <ul className="space-y-1">
            {flagEntries.map(([k, msg]) => (
              <li key={k} className="rounded-md bg-amber-50 px-2 py-1.5 text-amber-900">
                <span className="font-mono text-xs font-semibold">{k}</span> — {msg}
              </li>
            ))}
          </ul>
        )}
        {vertices.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1">#</th>
                <th>Accuracy</th>
                <th>Samples</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {vertices.map((v) => (
                <tr key={v.seq} className="border-t border-slate-100">
                  <td className="py-1">{v.seq}</td>
                  <td className="tabular-nums">±{v.accuracyM.toFixed(1)} m</td>
                  <td>{v.samplesAveraged}</td>
                  <td className={local.perVertex.get(v.seq)?.length ? 'text-red-700' : 'text-slate-400'}>
                    {local.perVertex.get(v.seq)?.join(', ') || 'ok'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-xs text-slate-500">
          The server re-runs these checks on sync and is authoritative; accuracy thresholds come from the project's rule
          pack (warn &gt; {pack.thresholds.gpsAccuracyWarnM} m, discard &gt; {pack.thresholds.gpsAccuracyRejectM} m).
        </p>
      </Card>

      {draft && (
        <>
          {blocking.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              <p className="font-semibold">Before you can submit</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {blocking.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          <Button className="w-full py-3" disabled={busy || blocking.length > 0} onClick={submit}>
            {busy ? 'Queueing…' : 'Submit survey'}
          </Button>
          <p className="text-center text-xs text-slate-500">
            Submitting locks the survey and queues it; it uploads when you sync.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-600">{k}</span>
      <span className="text-right font-medium">{v}</span>
    </div>
  );
}
