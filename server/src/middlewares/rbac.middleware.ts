import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import type { Role } from "../constants/roles";
import type { Permission } from "../constants/permissions";

/** Restrict a route to one or more roles. Must run after `authenticate`. */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("You must be logged in to perform this action"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to perform this action"));
    }
    next();
  };
}

/**
 * Allows the request through if the authenticated user either has one of
 * `staffRoles` OR owns the resource identified by `getOwnerId`. Useful for
 * routes like "get my order" that customers can view for themselves and
 * staff can view for anyone.
 */
export function authorizeSelfOrRoles(
  getOwnerId: (req: Request) => string | undefined,
  ...staffRoles: Role[]
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("You must be logged in to perform this action"));
    }
    const ownerId = getOwnerId(req);
    if (req.user.id === ownerId || staffRoles.includes(req.user.role)) {
      return next();
    }
    next(ApiError.forbidden("You do not have permission to access this resource"));
  };
}

/**
 * Permission gate — the primary authorization check.
 *
 * Passes when the caller holds ANY of `required`; most routes name a single
 * permission, and the few that accept alternatives (view-or-manage) read
 * better as one call than as two stacked middlewares. Must run after
 * `authenticate`, which resolves `req.user.permissions` from the caller's
 * built-in role plus any custom role.
 *
 * This coexists with `authorize(...)` above rather than replacing it: a
 * handful of routes gate on role identity itself (delivery-agent endpoints
 * that are self-scoped by role, audit-log viewing that is scoped server-side
 * per role) where a permission would be the wrong shape. Everything with a
 * meaningful capability behind it uses this.
 */
export function requirePermission(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("You must be logged in to perform this action"));
    }
    const held = req.user.permissions ?? [];
    if (required.some((permission) => held.includes(permission))) {
      return next();
    }
    next(ApiError.forbidden("You do not have permission to perform this action"));
  };
}

/** Like `requirePermission`, but every listed permission must be held. */
export function requireAllPermissions(...required: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("You must be logged in to perform this action"));
    }
    const held = new Set(req.user.permissions ?? []);
    if (required.every((permission) => held.has(permission))) {
      return next();
    }
    next(ApiError.forbidden("You do not have permission to perform this action"));
  };
}
