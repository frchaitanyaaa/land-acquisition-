import { HttpException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ProblemException, toProblem } from '../src/common/errors/problem';

describe('toProblem (RFC 7807)', () => {
  it('keeps a ProblemException code and extensions', () => {
    const p = toProblem(new ProblemException(422, 'GUARD_FAILED', 'Checklist incomplete', { failures: [{ code: 'X' }] }));
    expect(p).toMatchObject({ status: 422, code: 'GUARD_FAILED', type: 'urn:bhoomisetu:problem:guard-failed', failures: [{ code: 'X' }] });
  });

  it('turns zod errors into a 400 with field paths', () => {
    const r = z.object({ email: z.email() }).safeParse({ email: 'nope' });
    const p = toProblem(r.error);
    expect(p.status).toBe(400);
    expect(p.code).toBe('VALIDATION_FAILED');
    expect(p.errors).toEqual([expect.objectContaining({ path: 'email' })]);
  });

  it('maps an RLS violation wrapped by drizzle to 403 without leaking SQL', () => {
    const pg = Object.assign(new Error('new row violates row-level security policy for table "projects"'), { code: '42501' });
    const wrapped = Object.assign(new Error('Failed query: insert into "projects" ...'), { cause: pg });
    const p = toProblem(wrapped);
    expect(p).toMatchObject({ status: 403, code: 'FORBIDDEN_SCOPE' });
    expect(JSON.stringify(p)).not.toMatch(/insert into|row-level/);
  });

  it('maps unique violations to 409', () => {
    expect(toProblem(Object.assign(new Error('dup'), { code: '23505' })).status).toBe(409);
  });

  it('maps framework HttpExceptions by status', () => {
    expect(toProblem(new HttpException('nope', 404))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('hides unknown errors behind a 500', () => {
    const p = toProblem(new Error('connection string postgres://secret@db'));
    expect(p).toMatchObject({ status: 500, code: 'INTERNAL' });
    expect(p.detail).not.toMatch(/secret/);
  });
});
