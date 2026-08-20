import type { Role } from "../constants/roles";
import type { Permission } from "../constants/permissions";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        /**
         * Effective permissions: the built-in role's set plus any custom
         * role's, resolved by `authenticate`. `requirePermission(...)` reads
         * this; it is the authoritative answer to "may this caller do X?".
         */
        permissions: Permission[];
        tokenVersion: number;
        isEmailVerified: boolean;
        /** Set only when a Super Admin is acting as this user via support-login. */
        impersonatedBy?: string;
      };
    }
  }
}

export {};
