import { NextFunction, Request, Response } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async route handler so thrown/rejected errors are forwarded to
 * Express's error-handling middleware. Express 5 already does this
 * automatically for async handlers, but wrapping explicitly keeps behaviour
 * obvious and safe if the app is ever downgraded to Express 4.
 */
export function catchAsync(handler: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}
