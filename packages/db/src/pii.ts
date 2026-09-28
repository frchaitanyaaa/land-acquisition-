import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// PII at rest (§11.5): AES-256-GCM, random 12-byte IV per value, stored as iv || ciphertext || tag.
// Key = PII_ENCRYPTION_KEY (base64 of 32 bytes). Outside production a non-conforming key (the
// .env.example placeholder) is stretched with sha256 so dev and seed still work.

function key(): Buffer {
  const raw = process.env.PII_ENCRYPTION_KEY ?? '';
  const b = Buffer.from(raw, 'base64');
  if (b.length === 32) return b;
  if (process.env.NODE_ENV === 'production') throw new Error('PII_ENCRYPTION_KEY must be base64 of 32 bytes');
  return createHash('sha256').update(`bhoomisetu-dev-pii:${raw}`).digest();
}

export function encryptPii(plain: string, iv: Buffer = randomBytes(12)): Buffer {
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return Buffer.concat([iv, ct, c.getAuthTag()]);
}

export function decryptPii(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(12, blob.length - 16)), d.final()]).toString('utf8');
}

/** "9812345621" → "98XXXXXX21" */
export const maskPhone = (p: string) =>
  p.length < 4 ? 'XXXX' : `${p.slice(0, 2)}${'X'.repeat(p.length - 4)}${p.slice(-2)}`;
/** "123456784821" → "XXXX4821" */
export const maskBankRef = (r: string) => `XXXX${r.slice(-4)}`;
