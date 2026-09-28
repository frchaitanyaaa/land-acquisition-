import type {} from 'multer';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DOC_TYPES } from '@bhoomisetu/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { ProblemException } from '../common/errors/problem';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { DocumentsService, MAX_UPLOAD_BYTES } from './documents.service';

const bool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);
const UploadFields = z.object({
  projectId: z.uuid().optional(),
  entityType: z.string().min(1).max(64).default('project'),
  entityId: z.uuid().optional(),
  docType: z.enum(DOC_TYPES),
  title: z.string().min(1).max(300),
  language: z.string().max(10).optional(),
  supersedesId: z.uuid().optional(),
  attest: bool.default(false),
  declarationVersion: z.string().max(20).optional(),
  sha256: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/)
    .optional(),
});
const ListQuery = z.object({
  projectId: z.uuid().optional(),
  entityType: z.string().optional(),
  entityId: z.uuid().optional(),
  docType: z.string().optional(),
});

/** §26 — upload through the API (never direct-to-bucket), attestation at upload, versioning. */
@Controller()
@AuditEntity('document')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get('declarations/current')
  declaration(@CurrentUser() user: AuthUser) {
    return this.docs.declaration(user);
  }

  @Post('documents')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File | undefined, @Body() body: unknown) {
    if (!file) throw new ProblemException(400, 'NO_FILE', 'Send the file as multipart field `file`.');
    const f = UploadFields.parse(body);
    const entityId = f.entityId ?? f.projectId;
    if (!entityId) throw new ProblemException(400, 'ENTITY_REQUIRED', 'Give entityId (or projectId).');
    return this.docs.upload(user, {
      projectId: f.projectId ?? null,
      entityType: f.entityType,
      entityId,
      docType: f.docType,
      title: f.title,
      language: f.language,
      supersedesId: f.supersedesId,
      attest: f.attest,
      declarationVersion: f.declarationVersion,
      filename: file.originalname,
      buffer: file.buffer,
      expectSha256: f.sha256,
    });
  }

  @Get('documents')
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.docs.list(user, q);
  }

  @Get('documents/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.docs.get(user, id);
  }

  @Get('documents/:id/download')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.docs.download(user, id);
    if ('url' in r && r.url) {
      res.redirect(302, r.url);
      return;
    }
    res.setHeader('Content-Type', r.mime);
    res.setHeader('Content-Disposition', `inline; filename="${r.filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile((r as { body: Buffer }).body);
  }
}
