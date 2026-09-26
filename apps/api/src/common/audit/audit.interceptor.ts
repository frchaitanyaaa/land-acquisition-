import { Injectable, SetMetadata, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { mergeMap, type Observable } from 'rxjs';
import { requestContext } from '../context/request-context';
import { AuditService } from './audit.service';

const AUDIT_ENTITY = 'bhoomisetu:audit-entity';

/** Names the entity a controller (or handler) mutates, for the fallback audit row. */
export const AuditEntity = (entityType: string) => SetMetadata(AUDIT_ENTITY, entityType);

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const asUuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

/**
 * Safety net for G15 ("every mutation writes to audit_log"). Services should record a precise row
 * with before/after via AuditService; if a successful mutating request wrote none, this writes a
 * request-level row so nothing goes unrecorded.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    if (!MUTATING.has(req.method)) return next.handle();

    const entityType =
      this.reflector.getAllAndOverride<string | undefined>(AUDIT_ENTITY, [context.getHandler(), context.getClass()]) ??
      context.getClass().name.replace(/Controller$/, '').toLowerCase();

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        if (!requestContext.get()?.audited) {
          await this.audit.record({
            action: `${req.method} ${(req.route as { path?: string } | undefined)?.path ?? req.path}`,
            entityType,
            entityId: asUuid(req.params?.id) ?? asUuid((body as { id?: unknown } | null)?.id),
          });
        }
        return body;
      }),
    );
  }
}
