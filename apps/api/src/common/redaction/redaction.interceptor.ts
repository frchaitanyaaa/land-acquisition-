import { redactTree, tagEntity, type Viewer } from '@bhoomisetu/shared';
import { Injectable, SetMetadata, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { map, type Observable } from 'rxjs';
import { bigintToString } from '../json';

const REDACT_AS = 'bhoomisetu:redact-as';

/**
 * Declares the entity a handler returns (an object or an array of them), so FIELD_VISIBILITY
 * rules apply without tagging each DTO by hand. Nested DTOs of other entities still need
 * `tagEntity()` in the service that builds them.
 */
export const RedactAs = (entity: string) => SetMetadata(REDACT_AS, entity);

/**
 * Strips restricted fields per the viewer's post before serialising (§11.4, G13). Runs on every
 * response, so a restricted value never reaches the browser's network tab. Also turns bigint
 * paise into strings, which JSON cannot carry. Redacted keys are listed in X-Redacted-Fields.
 */
@Injectable()
export class RedactionInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const rootEntity = this.reflector.get<string | undefined>(REDACT_AS, context.getHandler());
    const viewer: Viewer = req.user ? { role: req.user.post.role, level: req.user.post.level } : null;

    return next.handle().pipe(
      map((body: unknown) => {
        const tagged = rootEntity ? tagRoot(rootEntity, body) : body;
        const { value, redacted } = redactTree(tagged, viewer, bigintToString);
        if (redacted.length && !res.headersSent) res.setHeader('X-Redacted-Fields', redacted.join(','));
        return value;
      }),
    );
  }
}

function tagRoot(entity: string, body: unknown): unknown {
  const tag = (v: unknown) => (v && typeof v === 'object' ? tagEntity(entity, { ...(v as object) }) : v);
  return Array.isArray(body) ? body.map(tag) : tag(body);
}
