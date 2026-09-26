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
