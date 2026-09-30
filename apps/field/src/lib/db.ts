import Dexie, { type Table } from 'dexie';
import type {
  Assignment,
  JirItemRow,
  OfflinePackRow,
  OutboxRow,
  PhotoRow,
  PillarRow,
  SurveyRow,
  VertexRow,
} from './types';

/**
 * Offline-first store (§16.1, §16.3). Everything captured lands here first; the sync engine
 * (lib/sync.ts) is the only thing that talks to the server about it. Used by the page and the
 * service worker alike, so this file must stay free of DOM-only APIs.
 */
export class FieldDb extends Dexie {
  declare assignments: Table<Assignment, string>;
  declare offlinePacks: Table<OfflinePackRow, string>;
  declare surveys: Table<SurveyRow, string>;
  declare vertices: Table<VertexRow, [string, number]>;
  declare photos: Table<PhotoRow, string>;
  declare jirItems: Table<JirItemRow, string>;
  declare pillars: Table<PillarRow, string>;
  declare outbox: Table<OutboxRow, number>;

  constructor() {
    super('bhoomisetu-field');
    this.version(1).stores({
      assignments: 'project_parcel_id, project_id',
      offlinePacks: 'projectParcelId',
      surveys: 'clientId, projectParcelId, status',
      vertices: '[surveyClientId+seq], surveyClientId',
      photos: 'localId, surveyClientId, status',
      jirItems: 'localId, surveyClientId',
      pillars: 'localId, surveyClientId',
      outbox: '++id, &idempotencyKey, surveyClientId, status',
    });
  }
}

export const db = new FieldDb();
