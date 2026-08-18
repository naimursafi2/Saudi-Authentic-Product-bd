import rateLimit from "express-rate-limit";

/** Tighter limit for auth endpoints to slow down credential-stuffing/brute force attempts. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts from this device. Please try again in a few minutes.",
  },
});

/** General API-wide limiter, generous enough not to bother normal browsing/shopping. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
