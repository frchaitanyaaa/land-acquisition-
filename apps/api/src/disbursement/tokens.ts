import { createHash, randomBytes } from 'node:crypto';

/** Single-use magic-link tokens (§10.3 access_tokens): only the sha256 is stored. */
export function newToken(): { token: string; hash: string } {
  const token = randomBytes(24).toString('base64url');
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
