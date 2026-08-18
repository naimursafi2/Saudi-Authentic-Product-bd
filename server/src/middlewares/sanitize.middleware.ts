import type { NextFunction, Request, Response } from "express";
import mongoSanitize from "express-mongo-sanitize";

/**
 * `express-mongo-sanitize`'s own middleware does `req.query = sanitize(req.query)`,
 * but Express 5 exposes `req.query` as a *getter* with no setter that
 * re-parses `req.url` from scratch on every single access (see
 * express/lib/request.js) — so `req.query = ...` throws, and merely
 * mutating the object one access returns (e.g. `mongoSanitize.sanitize(req.query)`
 * in place) is silently discarded the next time anything reads `req.query`,
 * leaving requests effectively unsanitized. The fix is the same one used in
 * validate.middleware.ts: redefine the property as a plain, static value so
 * it stops being re-derived from the raw URL.
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object") mongoSanitize.sanitize(req.body);
  if (req.params && typeof req.params === "object") mongoSanitize.sanitize(req.params);
  if (req.query && typeof req.query === "object") {
    const sanitized = mongoSanitize.sanitize({ ...req.query } as Record<string, unknown>);
    Object.defineProperty(req, "query", {
      value: sanitized,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  next();
}
