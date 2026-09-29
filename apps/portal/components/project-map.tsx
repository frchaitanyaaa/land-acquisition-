'use client';

import { GeoJSON as LeafletGeoJSON } from 'react-leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature, Geometry } from 'geojson';
import { useRouter } from 'next/navigation';
import { BaseMap } from '@/components/base-map';
import { STATUS_COLOR } from '@/components/status';
import type { ProjectMapRow } from '@/lib/dashboards-api';

export function ProjectMap({ projects }: { projects: ProjectMapRow[] }) {
  const router = useRouter();
  const withFootprint = projects.filter((p) => p.footprint);

  return (
    <BaseMap>
      {withFootprint.map((p) => (
        <ProjectFeature key={p.project_id} project={p} onOpen={() => router.push(`/project/${p.project_id}`)} />
      ))}
    </BaseMap>
  );
}

function ProjectFeature({ project, onOpen }: { project: ProjectMapRow; onOpen: () => void }) {
  const color = STATUS_COLOR[project.risk];
  const style: PathOptions = { color, weight: 2, fillColor: color, fillOpacity: 0.25 };

  const feature: Feature<Geometry> = {
    type: 'Feature',
    geometry: project.footprint as Geometry,
    properties: { id: project.project_id },
  };

  function onEachFeature(_f: Feature, layer: Layer) {
    layer.bindTooltip(`${project.code} — ${project.name}`, { sticky: true });
    layer.on('click', onOpen);
  }

  return <LeafletGeoJSON data={feature} style={style} onEachFeature={onEachFeature} />;
}
