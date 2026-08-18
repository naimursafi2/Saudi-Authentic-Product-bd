import type { NextFunction, Request, Response } from "express";
import { z, ZodError, type ZodType } from "zod";
import { ApiError } from "../utils/ApiError";

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Validates (and coerces) req.body/query/params against the given zod schemas. */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) {
        // Express 5's `req.query` is a getter that re-parses `req.url` from
        // scratch on every access (see request.js) — it has no setter, and
        // mutating the object one access returns is silently discarded the
        // next time something reads `req.query`. The only way to make
        // validated/coerced/defaulted query values actually stick is to
        // redefine the property as a plain, static value.
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, "query", {
          value: parsed,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(ApiError.badRequest("Validation failed", z.flattenError(err).fieldErrors));
      }
      next(err);
    }
  };
}
