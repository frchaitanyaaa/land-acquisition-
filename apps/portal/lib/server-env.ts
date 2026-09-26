/** Server components only (reads process.env at request time). The root .env is loaded by next.config.ts. */
export const serverEnv = {
  apiOrigin: `http://localhost:${process.env.API_PORT ?? '3001'}`,
  demoMode: process.env.DEMO_MODE === 'true',
};
