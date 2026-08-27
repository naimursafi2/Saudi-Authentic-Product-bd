import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { isProduction } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
  } else if (err?.name === "ValidationError") {
    // Mongoose validation error
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors ?? {}).map((e) => (e as { message: string }).message);
  } else if (err?.code === 11000) {
    // Mongoose duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    message = `${field} already exists`;
  } else if (err?.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  } else if (err?.name === "JsonWebTokenError" || err?.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Invalid or expired session";
  } else if (err?.name === "MulterError" && err?.code === "LIMIT_FILE_SIZE") {
    // Multer's own error otherwise falls through to the generic 500 branch
    // below — this is a client mistake (file too large), not a server fault.
    statusCode = 400;
    message = "File is too large. The maximum upload size is 2MB.";
  } else if (err instanceof Error) {
    message = err.message || message;
  }

  if (statusCode >= 500) {
    console.error("Unexpected error:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(isProduction ? {} : { stack: err?.stack }),
  });
}
