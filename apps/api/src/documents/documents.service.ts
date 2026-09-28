import { createHash, randomUUID } from 'node:crypto';
import { attestations, documents, type Tx } from '@bhoomisetu/db';
import {
  CURRENT_DECLARATION,
  DECLARATIONS,
  renderDeclaration,
  type DeclarationVersion,
  type DocType,
} from '@bhoomisetu/shared';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { StorageService } from '../adapters/storage/storage.adapter';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/auth-user';
import { ClockService } from '../common/clock/clock.service';
import { requestContext } from '../common/context/request-context';
import { DbService } from '../common/db/db.service';
import { one, rows } from '../common/db/raw';
import { ProblemException } from '../common/errors/problem';
import { writeOutbox } from '../common/outbox/outbox';
import { sniff } from './sniff';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** Evidence photos are captured in-app and carry their own geo/time proof; everything else is a legal document (G21). */
const NO_ATTESTATION: ReadonlySet<string> = new Set(['FIELD_PHOTO', 'PILLAR_PHOTO']);

export interface StoreInput {
  projectId: string | null;
  entityType: string;
  entityId: string;
  docType: DocType;
  title: string;
  language?: string | null;
  supersedesId?: string | null;
  attest: boolean;
  declarationVersion?: string | null;
  filename: string;
  buffer: Buffer;
  /** Client-declared sha256 (field sync): rejected if it does not match (§16.4). */
  expectSha256?: string | null;
}

export function jurisdictionOf(user: AuthUser): string {
  const p = user.post;
  return p.level === 'NATIONAL'
    ? 'National'
    : p.level === 'STATE'
      ? `State ${p.stateCode}`
      : p.level === 'DISTRICT'
        ? `District ${p.districtCode}`
        : `Project scope`;
}

/** Documents, versioning and per-document attestation (§26). */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly clock: ClockService,
  ) {}

  declaration(user: AuthUser) {
    return {
      version: CURRENT_DECLARATION,
      text: renderDeclaration(CURRENT_DECLARATION, {
        fullName: user.fullName,
        designation: user.post.designation,
        jurisdiction: jurisdictionOf(user),
      }),
    };
  }

  upload(user: AuthUser, input: StoreInput) {
    return this.db.withScope(user, (tx) => this.store(tx, user, input));
  }

  /** Stores a document inside an existing scoped transaction (used by other modules). */
  async store(tx: Tx, user: AuthUser, input: StoreInput) {
    if (input.buffer.length === 0) throw new ProblemException(422, 'EMPTY_FILE', 'The file is empty.');
    if (input.buffer.length > MAX_UPLOAD_BYTES)
      throw new ProblemException(413, 'FILE_TOO_LARGE', 'Maximum upload size is 25 MB.');
    const kind = sniff(input.buffer, input.filename);
    if (!kind)
      throw new ProblemException(
        415,
        'FILE_TYPE_NOT_ALLOWED',
        'Allowed: pdf, jpeg, png, webp, m4a, mp3, wav, kml, kmz, geojson, zip, csv (detected by content).',
      );

    const needsAttestation = !NO_ATTESTATION.has(input.docType);
    if (needsAttestation) {
      if (!input.attest)
        throw new ProblemException(422, 'ATTESTATION_REQUIRED', 'Legal documents must be attested at upload (G21).');
      if (input.declarationVersion && !(input.declarationVersion in DECLARATIONS)) {
        throw new ProblemException(
          422,
          'DECLARATION_UNKNOWN',
          `Unknown declaration version ${input.declarationVersion}.`,
        );
      }
    }
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    if (input.expectSha256 && input.expectSha256.toLowerCase() !== sha256) {
      throw new ProblemException(422, 'SHA256_MISMATCH', 'The file does not match its declared sha256.');
    }

    let version = 1;
    if (input.supersedesId) {
      const [prev] = await tx.select().from(documents).where(eq(documents.id, input.supersedesId));
      if (!prev) throw new ProblemException(404, 'DOCUMENT_NOT_FOUND', 'The document being superseded does not exist.');
      version = prev.version + 1;
    }
    const now = this.clock.now();
    const objectKey = `${input.projectId ?? 'global'}/${input.entityType}/${input.entityId}/${randomUUID()}.${kind.ext}`;
    await this.storage.put(objectKey, input.buffer, kind.mime);

    const [doc] = await tx
      .insert(documents)
      .values({
        projectId: input.projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        docType: input.docType,
        title: input.title,
        language: input.language ?? null,
        version,
        supersedesId: input.supersedesId ?? null,
        objectKey,
        mime: kind.mime,
        sizeBytes: input.buffer.length,
        sha256,
        uploadedByUserId: user.id,
        uploadedByPostId: user.post.id,
        uploadedAt: now,
      })
      .returning();
    if (!doc) throw new Error('insert returned nothing');

    let attestation = null;
    if (needsAttestation) {
      const ctx = requestContext.get();
      const declarationVersion = (input.declarationVersion ?? CURRENT_DECLARATION) as DeclarationVersion;
      [attestation] = await tx
        .insert(attestations)
        .values({
          documentId: doc.id,
          userId: user.id,
          postId: user.post.id,
          designationSnapshot: user.post.designation,
          jurisdictionSnapshot: jurisdictionOf(user),
          declarationVersion,
          documentSha256: sha256,
          ip: ctx?.ip ?? null,
          userAgent: ctx?.userAgent ?? null,
          attestedAt: now,
        })
        .returning();
      await writeOutbox(tx, {
        type: 'DOCUMENT_ATTESTED',
        aggregateType: 'document',
        aggregateId: doc.id,
        payload: {
          documentId: doc.id,
          sha256,
          postId: user.post.id,
          declarationVersion,
          attestedAt: now,
          projectId: input.projectId,
        },
      });
    }
    await this.audit.record({
      action: 'DOCUMENT_UPLOADED',
      entityType: 'document',
      entityId: doc.id,
      after: { ...doc, attested: !!attestation },
    });
    return { ...doc, attestation };
  }

  list(user: AuthUser, f: { projectId?: string; entityType?: string; entityId?: string; docType?: string }) {
    return this.db.withScope(user, (tx) =>
      rows(
        tx,
        sql`SELECT d.id, d.project_id, d.entity_type, d.entity_id, d.doc_type, d.title, d.language, d.version, d.supersedes_id,
                   d.mime, d.size_bytes, d.sha256, d.uploaded_at, d.uploaded_by_post_id, po.designation AS uploaded_by_designation,
                   a.declaration_version, a.attested_at, a.designation_snapshot,
                   NOT EXISTS (SELECT 1 FROM documents n WHERE n.supersedes_id = d.id) AS is_current
            FROM documents d LEFT JOIN attestations a ON a.document_id = d.id LEFT JOIN posts po ON po.id = d.uploaded_by_post_id
            WHERE (${f.projectId ?? null}::uuid IS NULL OR d.project_id = ${f.projectId ?? null}::uuid)
              AND (${f.entityType ?? null}::text IS NULL OR d.entity_type = ${f.entityType ?? null})
              AND (${f.entityId ?? null}::uuid IS NULL OR d.entity_id = ${f.entityId ?? null}::uuid)
              AND (${f.docType ?? null}::text IS NULL OR d.doc_type::text = ${f.docType ?? null})
            ORDER BY d.uploaded_at DESC LIMIT 500`,
      ),
    );
  }

  get(user: AuthUser, id: string) {
    return this.db.withScope(user, async (tx) => {
      const [doc] = await tx.select().from(documents).where(eq(documents.id, id));
      if (!doc) throw new ProblemException(404, 'DOCUMENT_NOT_FOUND', 'No such document in your jurisdiction.');
      const [attestation] = await tx.select().from(attestations).where(eq(attestations.documentId, id));
      const lineage = await rows(
        tx,
        sql`WITH RECURSIVE up AS (SELECT id, supersedes_id, version, uploaded_at FROM documents WHERE id = ${id}
                                  UNION ALL SELECT d.id, d.supersedes_id, d.version, d.uploaded_at FROM documents d JOIN up ON d.id = up.supersedes_id)
            SELECT id, version, uploaded_at FROM up ORDER BY version`,
      );
      const newer = await tx
        .select({ id: documents.id, version: documents.version })
        .from(documents)
        .where(eq(documents.supersedesId, id))
        .orderBy(desc(documents.version));
      return { ...doc, attestation: attestation ?? null, lineage, supersededBy: newer[0] ?? null };
    });
  }

  /** Permission check (RLS) first, then a short-TTL presigned URL or the bytes themselves (§26.1 step 6). */
  async download(user: AuthUser, id: string) {
    const doc = await this.db.withScope(user, async (tx) => {
      const [d] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id)));
      return d;
    });
    if (!doc) throw new ProblemException(404, 'DOCUMENT_NOT_FOUND', 'No such document in your jurisdiction.');
    const filename = `${doc.docType}-v${doc.version}.${doc.objectKey.split('.').pop()}`;
    const url = await this.storage.presign(doc.objectKey, filename);
    if (url) return { url, filename, mime: doc.mime };
    return { body: await this.storage.get(doc.objectKey), filename, mime: doc.mime };
  }

  /** For callers that already hold a transaction and need the stored hash (payload builders, checklists). */
  async sha(tx: Tx, id: string) {
    return (await one<{ sha256: string }>(tx, sql`SELECT sha256 FROM documents WHERE id = ${id}`))?.sha256 ?? null;
  }
}
