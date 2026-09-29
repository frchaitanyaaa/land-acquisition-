'use client';

import dynamic from 'next/dynamic';
import { use, useState } from 'react';
import { ChainageStrip } from '@/components/chainage-strip';
import { COLOR_BY_LEGEND, parcelColor } from '@/components/parcel-colors';
import { FlagsPanel } from '@/components/flags-panel';
import { useChainage, useParcels, type ColorBy } from '@/lib/parcels-api';

const ParcelMap = dynamic(() => import('@/components/parcel-map').then((m) => m.ParcelMap), {
  ssr: false,
  loading: () => <div className="h-[32rem] w-full animate-pulse border border-slate-200 bg-slate-100" />,
});
const ParcelDetail = dynamic(() => import('@/components/parcel-detail').then((m) => m.ParcelDetail), { ssr: false });

const COLOR_BY_OPTIONS: Array<{ value: ColorBy; label: string }> = [
  { value: 'stage', label: 'Stage' },
  { value: 'payment', label: 'Payment' },
  { value: 'risk', label: 'Deadline risk' },
];

export default function ProjectParcels({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [colorBy, setColorBy] = useState<ColorBy>('stage');
  const [selectedBin, setSelectedBin] = useState<number | null>(null);
  const [selectedParcelId, setSelectedParcelId] = useState<string | null>(null);

  const { data, isLoading, error } = useParcels(id, colorBy);
  const { data: chainage } = useChainage(id);

  if (error) return <p className="text-red-700">Could not load the parcel map.</p>;
  if (isLoading || !data) return <p className="text-slate-500">Loading…</p>;

  const features = selectedBin === null ? data.features : data.features.filter((f) => binOf(f.properties.chainage_km) === selectedBin);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-slate-900">
          Parcels <span className="text-sm font-normal text-slate-500">({data.features.length})</span>
        </h1>
        <div className="flex gap-1 rounded-md border border-slate-300 p-0.5">
          {COLOR_BY_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setColorBy(o.value)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                colorBy === o.value ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {chainage && chainage.length > 0 && (
        <ChainageStrip bins={chainage} selectedBin={selectedBin} onSelect={setSelectedBin} />
      )}

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {COLOR_BY_LEGEND[colorBy].map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: parcelColor(colorBy, l.key) }} />
            {l.label}
          </span>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <ParcelMap features={features} colorBy={colorBy} selectedId={selectedParcelId} onSelect={setSelectedParcelId} bbox={data.project.bbox} />
        </div>
        {selectedParcelId && (
          <ParcelDetail parcelId={selectedParcelId} projectId={id} onClose={() => setSelectedParcelId(null)} />
        )}
      </div>

      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Spatial flags (s.10 / s.41 / overlap)</h2>
        <FlagsPanel projectId={id} />
      </section>
    </div>
  );
}

function binOf(chainageKm: string | null): number | null {
  if (chainageKm === null) return null;
  return Math.floor((Number(chainageKm) * 1000) / 500);
}
