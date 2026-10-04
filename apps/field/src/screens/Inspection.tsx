import { useState } from 'react';
import { Camera, type Capture } from '../components/Camera';
import { Button, Card, ErrorText, Field, inputClass } from '../components/ui';
import { db } from '../lib/db';
import { useLive } from '../lib/live';
import { usePosition } from '../lib/position';
import { go } from '../lib/router';
import { addJirItem, addPillar, deleteJirItem, deletePillar, savePhoto } from '../lib/survey';
import type { JirItemType } from '../lib/types';
import { PhotoThumb } from './PhotoThumb';
import type { SurveyProps } from './SurveyShell';

const label = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

/** §16.2 screen 6 — joint inspection items (type from the offline pack) and boundary pillars. */
export function Inspection({ survey, pack }: SurveyProps) {
  usePosition();
  const editable = survey.status === 'draft';
  const items = useLive(() => db.jirItems.where('surveyClientId').equals(survey.clientId).sortBy('createdAt'), [survey.clientId]) ?? [];
  const pillars = useLive(() => db.pillars.where('surveyClientId').equals(survey.clientId).sortBy('pillarNo'), [survey.clientId]) ?? [];

  const types = pack.jirItemTypes;
  const [itemType, setItemType] = useState<JirItemType>(types[0] ?? 'OTHER');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [camera, setCamera] = useState<'jir' | 'pillar' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextPillar = pillars.reduce((m, p) => Math.max(m, p.pillarNo), 0) + 1;

  function startJir() {
    setError(null);
    const q = quantity.trim() === '' ? null : Number(quantity);
    if (q != null && (!Number.isFinite(q) || q < 0)) return setError('Quantity must be a number ≥ 0.');
    setCamera('jir');
  }

  async function onPhoto(c: Capture) {
    const kind = camera === 'pillar' ? 'PILLAR_PHOTO' : 'FIELD_PHOTO';
    const photoLocalId = await savePhoto({
      surveyClientId: survey.clientId,
      projectId: survey.projectId,
      kind,
      blob: c.blob,
      fix: c.fix,
      capturedAt: c.capturedAt,
    });
    if (camera === 'pillar') {
      await addPillar(survey.clientId, nextPillar, c.fix, photoLocalId);
    } else {
      await addJirItem({
        surveyClientId: survey.clientId,
        itemType,
        description: description.trim(),
        quantity: quantity.trim() === '' ? null : Number(quantity),
        unit: unit.trim(),
        photoLocalId,
        fix: c.fix,
      });
      setDescription('');
      setQuantity('');
      setUnit('');
    }
    setCamera(null);
  }

  return (
    <div className="space-y-4 p-4">
      <Card className="space-y-3">
        <h2 className="font-semibold">Joint inspection items ({items.length})</h2>
        {items.map((j) => (
          <div key={j.localId} className="flex items-center gap-3 border-t border-slate-100 pt-2 text-sm">
            <PhotoThumb localId={j.photoLocalId} />
            <div className="flex-1">
              <p className="font-medium">{label(j.itemType)}</p>
              <p className="text-slate-600">
                {[j.description, j.quantity != null ? `${j.quantity} ${j.unit}` : null].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {editable && (
              <button type="button" className="text-xs text-red-700" onClick={() => deleteJirItem(j.localId)}>
                Remove
              </button>
            )}
          </div>
        ))}
        {editable && (
          <div className="space-y-2 border-t border-slate-200 pt-3">
            <Field label="Type">
              <select value={itemType} onChange={(e) => setItemType(e.target.value as JirItemType)} className={inputClass}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {label(t)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description">
              <input value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="e.g. mango trees, mature" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Quantity">
                <input value={quantity} inputMode="decimal" onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Unit">
                <input value={unit} maxLength={30} onChange={(e) => setUnit(e.target.value)} className={inputClass} placeholder="nos, m, sq m" />
              </Field>
            </div>
            <ErrorText>{error}</ErrorText>
            <Button className="w-full" onClick={startJir}>
              Photograph & add item
            </Button>
          </div>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Boundary pillars ({pillars.length})</h2>
        {pillars.map((p) => (
          <div key={p.localId} className="flex items-center gap-3 border-t border-slate-100 pt-2 text-sm">
            <PhotoThumb localId={p.photoLocalId} />
            <p className="flex-1 font-medium">Pillar {p.pillarNo}</p>
            {editable && (
              <button type="button" className="text-xs text-red-700" onClick={() => deletePillar(p.localId)}>
                Remove
              </button>
            )}
          </div>
        ))}
        {editable && (
          <Button variant="secondary" className="w-full" onClick={() => setCamera('pillar')}>
            Stand at pillar {nextPillar} & photograph
          </Button>
        )}
      </Card>

      <Button variant="ghost" className="w-full" onClick={() => go(`survey/${survey.clientId}/review`)}>
        Next: review →
      </Button>
      {camera && (
        <Camera
          title={camera === 'pillar' ? `Pillar ${nextPillar}` : label(itemType)}
          onCapture={onPhoto}
          onCancel={() => setCamera(null)}
        />
      )}
    </div>
  );
}
