'use client';

import { useEffect, useState } from 'react';

/**
 * Landing hero background: real satellite imagery of Indian land (Esri World Imagery — the same source as the
 * portal's GIS basemap, attribution shown), cross-fading between places with a slow zoom. Each slide is a mosaic
 * of map tiles around a point. If the tiles cannot load (offline), the navy gradient underneath is what shows.
 */
const PLACES = [
  { name: 'Khed Shivapur, Pune', note: 'demo corridor village', lat: 18.3345, lng: 73.8745 },
  { name: 'Shirwal, Satara', note: 'Pune–Satara expressway', lat: 18.1525, lng: 73.9775 },
  { name: 'Ludhiana, Punjab', note: 'irrigated farmland', lat: 30.8705, lng: 75.7505 },
  { name: 'Varanasi, Uttar Pradesh', note: 'Ganga plains', lat: 25.2605, lng: 82.9405 },
  { name: 'Mandya, Karnataka', note: 'canal-fed fields', lat: 12.5235, lng: 76.8985 },
] as const;

const ZOOM = 15;
const COLS = 7;
const ROWS = 4;
const TILE_PX = 300;
const SLIDE_MS = 7000;
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

function tileOf(lat: number, lng: number, z: number) {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n),
  };
}

function Mosaic({ lat, lng }: { lat: number; lng: number }) {
  const c = tileOf(lat, lng, ZOOM);
  const tiles: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++)
      tiles.push({ x: c.x - Math.floor(COLS / 2) + col, y: c.y - Math.floor(ROWS / 2) + row });
  return (
    <div
      className="absolute left-1/2 top-1/2 grid -translate-x-1/2 -translate-y-1/2"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${TILE_PX}px)`, width: COLS * TILE_PX }}
    >
      {tiles.map((t) => (
        // Plain <img>: these are third-party map tiles, not assets Next should optimise.
        <img
          key={`${t.x}-${t.y}`}
          src={`${TILE_URL}/${ZOOM}/${t.y}/${t.x}`}
          alt=""
          width={TILE_PX}
          height={TILE_PX}
          className="block h-[300px] w-[300px] select-none"
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.visibility = 'hidden';
          }}
        />
      ))}
    </div>
  );
}

export function HeroBackdrop() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % PLACES.length), SLIDE_MS);
    return () => clearInterval(id);
  }, []);
  const place = PLACES[i] ?? PLACES[0];
  const next = (i + 1) % PLACES.length;

  return (
    <>
      <div className="absolute inset-0 overflow-hidden" aria-hidden>
        {PLACES.map((p, n) =>
          // Only the current slide and the next one are mounted, so at most two mosaics load at a time.
          n === i || n === next ? (
            <div
              key={p.name}
              className={`absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${n === i ? 'opacity-100' : 'opacity-0'}`}
            >
              <div className={`absolute inset-0 ${n === i ? 'hero-kenburns' : ''}`}>
                <Mosaic lat={p.lat} lng={p.lng} />
              </div>
            </div>
          ) : null,
        )}
        {/* Legibility: navy wash, darker at the centre where the text sits. */}
        <div className="absolute inset-0 bg-[#0e1a43]/45" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(8,16,43,0.72)_0%,rgba(8,16,43,0.25)_75%)]" />
      </div>
      <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-end justify-between gap-2 text-[11px] text-white/80">
        <span className="rounded bg-black/40 px-2 py-1 backdrop-blur-sm" aria-live="polite">
          <span className="mr-1" aria-hidden>
            ◉
          </span>
          {place.name} · {place.note}
        </span>
        <span className="rounded bg-black/40 px-2 py-1">Imagery © Esri, Maxar, Earthstar Geographics</span>
      </div>
    </>
  );
}
