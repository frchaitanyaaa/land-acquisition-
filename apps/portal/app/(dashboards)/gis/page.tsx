 'use client';

import dynamic from 'next/dynamic';

const GisWorkspace = dynamic(() => import('@/components/gis/gis-workspace').then((module) => module.GisWorkspace), {
  ssr: false,
  loading: () => <div className="h-[44rem] w-full animate-pulse border border-slate-200 bg-slate-100" />,
});

export default function GisPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold text-slate-900">Land registry and GIS</h1>
      <GisWorkspace />
    </div>
  );
}