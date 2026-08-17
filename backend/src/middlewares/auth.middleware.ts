import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { verifyAccessToken } from "../utils/jwt";
import { UserModel } from "../models/User.model";

/**
 * Verifies the access token (from the `accessToken` httpOnly cookie, or an
 * `Authorization: Bearer <token>` header as a fallback for non-browser
 * clients) and attaches `req.user`. Also re-checks the user is still active
 * and the token hasn't been invalidated by a `tokenVersion` bump
 * (logout-all / password change).
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : undefined;
    const token = req.cookies?.accessToken ?? bearer;

    if (!token) {
      throw ApiError.unauthorized("You must be logged in to perform this action");
    }

    const payload = verifyAccessToken(token);

    const user = await UserModel.findById(payload.sub).select("role isActive isEmailVerified tokenVersion");
    if (!user || !user.isActive) {
      throw ApiError.unauthorized("Your account is no longer active");
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw ApiError.unauthorized("Session expired, please log in again");
    }

    req.user = {
      id: user._id.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion,
      isEmailVerified: user.isEmailVerified,
    };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(ApiError.unauthorized("Invalid or expired session"));
  }
}

/** Like `authenticate`, but does not fail the request when no token is present. */
export async function attachUserIfPresent(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice("Bearer ".length)
    : undefined;
  const token = req.cookies?.accessToken ?? bearer;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await UserModel.findById(payload.sub).select("role isActive isEmailVerified tokenVersion");
    if (user && user.isActive && user.tokenVersion === payload.tokenVersion) {
      req.user = {
        id: user._id.toString(),
        role: user.role,
        tokenVersion: user.tokenVersion,
        isEmailVerified: user.isEmailVerified,
      };
    }
  } catch {
    // ignore invalid token — request proceeds unauthenticated
  }
  next();
}

/**
 * Gates customer-only write actions (placing an order, posting a review)
 * behind a verified email. Must run after `authenticate`. Staff roles are
 * always exempt — this policy exists for the storefront registration flow,
 * not internal accounts (which are provisioned directly by an admin and
 * marked verified at creation time).
 */
export function requireEmailVerified(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(ApiError.unauthorized("You must be logged in to perform this action"));
  }
  if (req.user.role !== "customer" || req.user.isEmailVerified) {
    return next();
  }
  next(
    ApiError.forbidden(
      "Please verify your email address before placing orders or posting reviews. Check your inbox for the verification link, or request a new one."
    )
  );
}
