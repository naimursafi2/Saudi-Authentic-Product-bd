import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * When a route accepts `multipart/form-data` (for file uploads), any
 * array/object fields (e.g. `variants`, `categories`, `highlights`) arrive
 * as JSON-encoded strings rather than real arrays/objects. This middleware
 * parses the given field names back into real JSON before validation runs.
 * A plain JSON request body is left untouched.
 */
export function parseMultipartJsonFields(fields: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.is("multipart/form-data")) return next();

    for (const field of fields) {
      const value = req.body?.[field];
      if (typeof value === "string" && value.length > 0) {
        try {
          req.body[field] = JSON.parse(value);
        } catch {
          return next(ApiError.badRequest(`Field "${field}" must be valid JSON`));
        }
      }
    }
    next();
  };
}
