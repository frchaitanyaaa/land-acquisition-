import type {} from 'multer';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuditEntity } from '../common/audit/audit.interceptor';
import type { AuthUser } from '../common/auth-user';
import { ProblemException } from '../common/errors/problem';
import { CurrentUser } from '../common/guards/decorators';
import { ZodPipe } from '../common/validation/zod.pipe';
import { fromGeoJson, parseAlignmentFile } from './alignment-parser';
import {
  AlignmentJsonBody,
  CreateProjectBody,
  EscrowDemandBody,
  EscrowDepositBody,
  EscrowGateParam,
  ListProjectsQuery,
  SubmitBody,
  UpdateProjectBody,
} from './projects.dto';
import { ProjectsService } from './projects.service';
import type { z } from 'zod';

const MAX_UPLOAD = 25 * 1024 * 1024;

/** Module A — proposal intake (§14). */
@Controller('projects')
@AuditEntity('project')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query(new ZodPipe(ListProjectsQuery)) q: z.infer<typeof ListProjectsQuery>) {
    return this.projects.list(user, q);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateProjectBody)) body: CreateProjectBody) {
    return this.projects.create(user, body);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.get(user, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateProjectBody)) body: UpdateProjectBody,
  ) {
    return this.projects.update(user, id, body);
  }

  /** Multipart `file` (.kml/.kmz/.geojson) or JSON `{ geojson }`. */
  @Post(':id/alignment')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD } }))
  async alignment(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: unknown,
  ) {
    const parsed = file
      ? await parseAlignmentFile(file.originalname, file.buffer)
      : fromGeoJson(AlignmentJsonBody.parse(body).geojson);
    if (!parsed) throw new ProblemException(400, 'NO_FILE', 'Upload a file or send { geojson }.');
    return this.projects.setAlignment(user, id, parsed);
  }

  @Post(':id/prescrutiny')
  @HttpCode(200)
  prescrutiny(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.projects.prescrutiny(user, id);
  }

  @Post(':id/submit')
  @HttpCode(200)
  submit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SubmitBody)) body: z.infer<typeof SubmitBody>,
  ) {
    return this.projects.submit(user, id, body.rulePack);
  }

  @Post(':id/escrow/:gate/demand')
  @AuditEntity('escrow_account')
  demand(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gate', new ZodPipe(EscrowGateParam)) gate: 'INITIAL' | 'FULL',
    @Body(new ZodPipe(EscrowDemandBody)) body: z.infer<typeof EscrowDemandBody>,
  ) {
    return this.projects.escrowDemand(user, id, gate, body.amountRupees, body.documentId);
  }

  @Post(':id/escrow/:gate/deposits')
  @AuditEntity('escrow_account')
  deposit(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gate', new ZodPipe(EscrowGateParam)) gate: 'INITIAL' | 'FULL',
    @Body(new ZodPipe(EscrowDepositBody)) body: z.infer<typeof EscrowDepositBody>,
  ) {
    return this.projects.escrowDeposit(user, id, gate, body.amountRupees, body.reference);
  }

  @Post(':id/escrow/:gate/certify')
  @HttpCode(200)
  @AuditEntity('escrow_account')
  certify(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('gate', new ZodPipe(EscrowGateParam)) gate: 'INITIAL' | 'FULL',
  ) {
    return this.projects.escrowCertify(user, id, gate);
  }
}
