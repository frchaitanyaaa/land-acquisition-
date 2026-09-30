import { Header } from '../components/Header';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { go } from '../lib/router';
import type { OfflinePack, SurveyRow } from '../lib/types';
import { Inspection } from './Inspection';
import { Notice } from './Notice';
import { Review } from './Review';
import { WalkMark } from './WalkMark';

export interface SurveyProps {
  survey: SurveyRow;
  pack: OfflinePack;
}

const TABS = [
  ['walk', 'Walk & Mark'],
  ['notice', 's.12 Notice'],
  ['jir', 'Inspection'],
  ['review', 'Review'],
] as const;

/** Screens 4–8 of §16.2 for one survey, all reading from Dexie only. */
export function SurveyShell({ clientId, tab, demoMode }: { clientId: string; tab: string; demoMode: boolean }) {
  const data = useLive(async () => {
    const survey = await db.surveys.get(clientId);
    const pack = survey ? await db.offlinePacks.get(survey.projectParcelId) : undefined;
    return { survey, pack: pack?.pack };
  }, [clientId]);

  if (!data) return null;
  const { survey, pack } = data;
  if (!survey || !pack)
    return (
      <div className="min-h-full bg-slate-50">
        <Header title="Survey" back="assignments" />
        <p className="p-4 text-sm text-slate-600">This survey or its offline pack is not on this device.</p>
      </div>
    );

  const locked = survey.status !== 'draft';
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <Header title={`${pack.assignment.projectCode} · parcel`} back="assignments" demoMode={demoMode} />
      <nav className="sticky top-[calc(env(safe-area-inset-top)+2.75rem)] z-[1400] flex border-b border-slate-200 bg-white text-sm">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => go(`survey/${clientId}/${key}`)}
            className={`flex-1 px-1 py-2.5 ${tab === key ? 'border-b-2 border-teal-700 font-semibold text-teal-800' : 'text-slate-600'}`}
          >
            {label}
          </button>
        ))}
      </nav>
      {locked && (
        <p className="bg-amber-50 px-4 py-2 text-xs text-amber-900">
          Submitted — this survey is read-only. See <button type="button" className="underline" onClick={() => go('sync')}>Sync status</button>.
        </p>
      )}
      <div className="flex-1">
        {tab === 'walk' && <WalkMark survey={survey} pack={pack} />}
        {tab === 'notice' && <Notice survey={survey} pack={pack} />}
        {tab === 'jir' && <Inspection survey={survey} pack={pack} />}
        {tab === 'review' && <Review survey={survey} pack={pack} />}
      </div>
    </div>
  );
}
