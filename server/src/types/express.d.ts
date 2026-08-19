import type { Role } from "../constants/roles";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        tokenVersion: number;
        isEmailVerified: boolean;
        /** Set only when a Super Admin is acting as this user via support-login. */
        impersonatedBy?: string;
      };
    }
  }
}

export {};
