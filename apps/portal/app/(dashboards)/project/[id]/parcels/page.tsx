'use client';

import { use } from 'react';
import { GisWorkspace } from '@/components/gis/gis-workspace';
import { FlagsPanel } from '@/components/gis/flags-panel';

export default function ProjectParcels({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="space-y-6">
      <GisWorkspace projectId={id} />
      <section>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Spatial flags (s.10 / s.41 / overlap)
        </h2>
        <FlagsPanel projectId={id} />
      </section>
    </div>
  );
}
