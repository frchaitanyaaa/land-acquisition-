import { createHash } from 'node:crypto';
import { idempotencyKeys, type Tx } from '@bhoomisetu/db';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '../auth-user';
import { ProblemException } from '../errors/problem';
import { toJsonSafe } from '../json';

/**
 * Idempotency-Key handling (§13). Runs inside the caller's scoped transaction: the stored response
 * commits with the change it describes, so a retry after a timeout gets the same answer.
 */
export async function idempotent<T>(
  tx: Tx,
  user: AuthUser,
  key: string | undefined,
  route: string,
  body: unknown,
  fn: () => Promise<T>,
  opts: { required?: boolean } = {},
): Promise<T> {
  if (!key) {
    if (opts.required)
      throw new ProblemException(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header with this request.');
    return fn();
  }
  if (key.length > 200) throw new ProblemException(400, 'IDEMPOTENCY_KEY_INVALID', 'Idempotency-Key is too long.');
  const scoped = `${user.id}:${key}`;
  const reqHash = createHash('sha256')
    .update(JSON.stringify(toJsonSafe(body)))
    .digest('hex');
  const [prev] = await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, scoped));
  if (prev) {
    if (prev.route !== route || prev.requestSha256 !== reqHash) {
      throw new ProblemException(
        422,
        'IDEMPOTENCY_KEY_REUSED',
        'This Idempotency-Key was used for a different request.',
      );
    }
    return prev.response as T;
  }
  const result = await fn();
  await tx
    .insert(idempotencyKeys)
    .values({ key: scoped, userId: user.id, route, requestSha256: reqHash, response: toJsonSafe(result) });
  return result;
}
