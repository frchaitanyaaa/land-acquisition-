import type {} from 'multer';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { DbService } from '../common/db/db.service';
import { ProblemException } from '../common/errors/problem';
import { idempotent } from '../common/idempotency/idempotency';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { DocumentsService, MAX_UPLOAD_BYTES } from '../documents/documents.service';
import { FieldOfficeService } from './field-office.service';
import { FieldService, SyncOp } from './field.service';

const SurveyQueueQuery = z.object({
  status: z.enum(['submitted', 'verified', 'returned']).default('submitted'),
  projectId: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
const CorrectionsQuery = z.object({ status: z.enum(['requested', 'approved', 'rejected']).default('requested') });
const ReturnBody = z.strictObject({ reason: z.string().trim().min(5).max(4000) });
const SyncBody = z.object({ ops: z.array(SyncOp).min(1).max(500) });
const PhotoFields = z.object({
  projectId: z.uuid(),
  surveyClientId: z.string().optional(),
  kind: z.enum(['FIELD_PHOTO', 'PILLAR_PHOTO', 'S12_NOTICE_OF_ENTRY']).default('FIELD_PHOTO'),
  sha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  accuracy: z.coerce.number().optional(),
  capturedAt: z.iso.datetime({ offset: true }),
  attest: z.enum(['true', 'false']).optional(),
});

/** Field PWA endpoints (§16). Bearer auth; Idempotency-Key required on sync (§13). */
@Controller('field')
@AuditEntity('field_survey')
export class FieldController {
  constructor(
    private readonly field: FieldService,
    private readonly docs: DocumentsService,
    private readonly db: DbService,
    private readonly office: FieldOfficeService,
  ) {}

  // ---- field office work queue (A4)

  @Get('surveys')
  surveys(@CurrentUser() user: AuthUser, @Query(new ZodPipe(SurveyQueueQuery)) q: z.infer<typeof SurveyQueueQuery>) {
    return this.office.list(user, q);
  }

  @Get('corrections')
  corrections(@CurrentUser() user: AuthUser, @Query(new ZodPipe(CorrectionsQuery)) q: z.infer<typeof CorrectionsQuery>) {
    return this.office.corrections(user, q.status);
  }

  @Get('surveys/:id')
  survey(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.office.get(user, id);
  }

  @Post('surveys/:id/return')
  @HttpCode(200)
  returnSurvey(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(ReturnBody)) body: z.infer<typeof ReturnBody>,
  ) {
    return this.office.returnSurvey(user, id, body.reason);
  }

  @Get('assignments')
  assignments(@CurrentUser() user: AuthUser) {
    return this.field.assignments(user);
  }

  @Get('assignments/:id/offline-pack')
  offlinePack(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.field.offlinePack(user, id);
  }

  @Post('sync')
  @HttpCode(200)
  sync(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key: string | undefined,
    @Body(new ZodPipe(SyncBody)) body: z.infer<typeof SyncBody>,
  ) {
    if (!key)
      throw new ProblemException(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with field sync.');
    return this.field.sync(user, body.ops);
  }

  /** In-app camera photo (§16.1). The server recomputes sha256 and rejects a mismatch (§16.4). */
  @Post('photos')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  photo(
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') key: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    if (!file) throw new ProblemException(400, 'NO_FILE', 'Send the photo as multipart field `file`.');
    const f = PhotoFields.parse(body);
    return this.db.withScope(user, (tx) =>
      idempotent(tx, user, key ?? `photo:${f.sha256}`, 'field:photo', { sha256: f.sha256 }, () =>
        this.docs.store(tx, user, {
          projectId: f.projectId,
          entityType: 'field_photo',
          entityId: f.projectId,
          docType: f.kind,
          title: `${f.kind} ${f.lat.toFixed(6)},${f.lng.toFixed(6)} ±${f.accuracy ?? '?'}m @ ${f.capturedAt}`,
          attest: f.attest === 'true',
          filename: file.originalname || 'photo.jpg',
          buffer: file.buffer,
          expectSha256: f.sha256,
        }),
      ),
    );
  }
}
