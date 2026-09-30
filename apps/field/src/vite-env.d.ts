/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Regional PMTiles basemap (§16.5), from the repo-root .env. */
  readonly TILES_PMTILES_URL?: string;
}
