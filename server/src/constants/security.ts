import type { Role } from "./roles";

/** Failed password attempts tolerated before the account is temporarily locked. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** How long an account stays locked once the attempt limit is hit. */
export const ACCOUNT_LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * Staff sessions are force-expired after this much inactivity, per the
 * security spec. Customers are deliberately exempt — an idle storefront
 * session being killed mid-shop is a UX regression, not a security win.
 */
export const STAFF_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

/** Avoids a `lastSeenAt` write on literally every authenticated request. */
export const ACTIVITY_WRITE_GRANULARITY_MS = 60 * 1000;

export const INACTIVITY_ENFORCED_ROLES: Role[] = [
  "employee",
  "delivery_agent",
  "co_admin",
  "order_manager",
  "admin",
  "super_admin",
];

/** An impersonation session is short-lived and cannot be refreshed. */
export const IMPERSONATION_TOKEN_TTL = "30m";

/** Number of single-use recovery codes issued when 2FA is enabled. */
export const TWO_FACTOR_RECOVERY_CODE_COUNT = 8;

/** How long a delivery verification OTP stays valid before it must be resent. */
export const DELIVERY_OTP_TTL_MINUTES = 5;

/** Incorrect delivery-OTP attempts tolerated before the code is invalidated and must be resent. */
export const MAX_DELIVERY_OTP_ATTEMPTS = 5;
