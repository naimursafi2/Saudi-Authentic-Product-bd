import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import type { Role } from "../constants/roles";

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
