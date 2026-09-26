import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';

// RFC 7807 application/problem+json (CLAUDE.md §9). `code` is the stable machine-readable name
// clients switch on; `type` is a URN derived from it.

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  [extension: string]: unknown;
}

export const problemType = (code: string) => `urn:bhoomisetu:problem:${code.toLowerCase().replace(/_/g, '-')}`;

/** Throw this from services and guards. Extensions become top-level members of the body. */
export class ProblemException extends HttpException {
  constructor(
    status: number,
    readonly code: string,
    detail: string,
    readonly extensions: Record<string, unknown> = {},
  ) {
    super(detail, status);
  }
}

const TITLES: Record<number, [code: string, title: string]> = {
  400: ['BAD_REQUEST', 'Bad request'],
  401: ['UNAUTHENTICATED', 'Not signed in'],
  403: ['FORBIDDEN', 'Not allowed'],
  404: ['NOT_FOUND', 'Not found'],
  409: ['CONFLICT', 'Conflict'],
  422: ['UNPROCESSABLE', 'Cannot be processed'],
  429: ['RATE_LIMITED', 'Too many requests'],
  500: ['INTERNAL', 'Internal error'],
};

const titleFor = (status: number) => (TITLES[status] ?? TITLES[500]!)[1];

/**
 * Postgres errors worth translating. drizzle wraps driver errors ("Failed query: …") and keeps the
 * original on `.cause`, so look there too. Details are deliberately generic: never echo SQL.
 */
const PG_ERRORS: Record<string, [status: number, code: string, detail: string]> = {
  '42501': [403, 'FORBIDDEN_SCOPE', 'This record is outside your jurisdiction, or your role may not change it.'],
  '23505': [409, 'ALREADY_EXISTS', 'A record with the same identifying values already exists.'],
  '23503': [422, 'REFERENCE_INVALID', 'The request refers to a record that does not exist or is not visible to you.'],
  '23514': [422, 'CONSTRAINT_VIOLATED', 'The values break a rule the record must satisfy.'],
  '23502': [422, 'REQUIRED_VALUE_MISSING', 'A required value is missing.'],
};

function pgCode(e: unknown): string | undefined {
  for (let cur: unknown = e, depth = 0; cur && depth < 4; cur = (cur as { cause?: unknown }).cause, depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
  }
  return undefined;
}

export function toProblem(e: unknown): Problem {
  if (e instanceof ProblemException) {
    const status = e.getStatus();
    return { type: problemType(e.code), title: titleFor(status), status, detail: e.message, code: e.code, ...e.extensions };
  }

  if (e instanceof ZodError) {
    return {
      type: problemType('VALIDATION_FAILED'),
      title: 'Invalid request',
      status: 400,
      detail: 'The request body or parameters are invalid.',
      code: 'VALIDATION_FAILED',
      errors: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }

  if (e instanceof HttpException) {
    const status = e.getStatus();
    const [code, title] = TITLES[status] ?? [HttpStatus[status] ?? 'ERROR', 'Error'];
    return { type: problemType(code), title, status, detail: e.message, code };
  }

  const pg = pgCode(e);
  if (pg && PG_ERRORS[pg]) {
    const [status, code, detail] = PG_ERRORS[pg];
    return { type: problemType(code), title: titleFor(status), status, detail, code };
  }

  return {
    type: problemType('INTERNAL'),
    title: 'Internal error',
    status: 500,
    detail: 'Something went wrong. Quote the request id when reporting it.',
    code: 'INTERNAL',
  };
}
