import { z } from 'zod';

// The API's view of .env (CLAUDE.md §7). Parsed lazily on first use, after main.ts has loaded the
// repo-root .env. Only what the API reads today is listed; add variables as modules need them.

const bool = z.enum(['true', 'false']).transform((v) => v === 'true');
const secret = z.string().min(8);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    PORTAL_URL: z.url().default('http://localhost:3000'),
    FIELD_URL: z.url().default('http://localhost:5173'),
    DATABASE_URL: z.string().min(1),
    DATABASE_WORKER_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: secret,
    DEMO_MODE: bool.default(false),
    DEMO_NOW: z
      .string()
      .optional()
      .transform((v) => v || undefined),
    STATUTORY_TZ: z.string().default('Asia/Kolkata'),
    /** Set to `off` to run the API without Redis (the relay then leaves events queued in Postgres). */
    OUTBOX_RELAY: z.enum(['on', 'off']).default('on'),
    S3_ENDPOINT: z.string().default('http://localhost:9000'),
    S3_ACCESS_KEY: z.string().default('minio'),
    S3_SECRET_KEY: z.string().default('minio12345'),
    S3_BUCKET: z.string().default('bhoomisetu-docs'),
    S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(300),
    STORAGE_PROVIDER: z.enum(['s3', 'local']).default('s3'),
    STORAGE_LOCAL_DIR: z.string().default('.data/storage'),
    PUBLIC_BASE_URL: z.url().default('http://localhost:3000'),
    WEBAUTHN_RP_ID: z.string().default('localhost'),
    WEBAUTHN_RP_NAME: z.string().default('BhoomiSetu'),
    WEBAUTHN_ORIGIN: z.string().default('http://localhost:3000'),
    PAYMENT_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    IDENTITY_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    CADASTRAL_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    SMS_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    STT_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    LLM_PROVIDER: z.enum(['mock', 'real']).default('mock'),
    LLM_API_KEY: z.string().optional(),
    LLM_MODEL: z.string().optional(),
    CHAIN_RPC_URL: z.string().default('http://localhost:8545'),
    CHAIN_ANCHOR_CONTRACT: z.string().optional().transform((v) => v || undefined),
    CHAIN_RELAYER_PRIVATE_KEY: z.string().optional().transform((v) => v || undefined),
    CHAIN_CONFIRMATIONS: z.coerce.number().int().min(0).default(1),
    SEED: z.string().default('26016'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || !/^change-me/.test(e.JWT_ACCESS_SECRET + e.JWT_REFRESH_SECRET), {
    message: 'JWT secrets still have their .env.example values',
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= EnvSchema.parse(process.env);
  return cached;
}
