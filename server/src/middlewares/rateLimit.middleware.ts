import rateLimit from "express-rate-limit";

/** Tighter limit for real credential-guessing targets: /login and /register
 *  (plus the password-reset/verification endpoints, which are similarly
 *  guessable-token targets) are where brute force / credential stuffing
 *  actually applies. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts from this device. Please try again in a few minutes.",
  },
});

/**
 * /auth/refresh and /auth/google aren't credential-guessing targets —
 * refresh only works with a valid httpOnly refresh cookie we already
 * issued, and /google only works with a real Google-issued ID token, so
 * rate-limiting them as tightly as password login mainly punishes shared-IP
 * users instead of attackers. That matters here because mobile carriers
 * (very common for this site's users) do carrier-grade NAT, where hundreds
 * of unrelated phones can share one public IP: every silent token refresh
 * across ALL of those users counts against the same 15-minute bucket, so a
 * handful of active people can exhaust it and everyone else behind that IP
 * starts getting silently logged out, or sees "Continue with Google"
 * quietly fail with no visible error. Kept separate and far more generous
 * for that reason.
 */
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
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
