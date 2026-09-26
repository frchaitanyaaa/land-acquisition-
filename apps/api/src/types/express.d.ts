import type { AuthUser } from '../common/auth-user';

// Merged into every Express Request (express-serve-static-core's Request extends Express.Request).
declare global {
  namespace Express {
    interface Request {
      /** Set by JwtGuard from the access token. */
      auth?: { userId: string; postId: string };
      /** Set by PostGuard: the user and their active post. */
      user?: AuthUser;
    }
  }
}

export {};
