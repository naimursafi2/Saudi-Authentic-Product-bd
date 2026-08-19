import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { IMPERSONATION_TOKEN_TTL } from "../constants/security";
import type { Role } from "../constants/roles";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  tokenVersion: number;
  /** Set only on impersonation tokens — the Super Admin acting as this user. */
  impersonatedBy?: string;
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export interface PasswordResetPayload {
  sub: string;
  tokenVersion: number;
  purpose: "password_reset";
}

/**
 * Short-lived, purpose-scoped token for the forgot-password flow. Signed
 * with the access secret but carries `tokenVersion` so it's invalidated the
 * moment the user changes their password or logs out of all devices.
 */
export function signPasswordResetToken(payload: Omit<PasswordResetPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "password_reset" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "30m",
  });
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as PasswordResetPayload;
  if (payload.purpose !== "password_reset") {
    throw new Error("Invalid token purpose");
  }
  return payload;
}

export interface EmailVerificationPayload {
  sub: string;
  purpose: "email_verification";
}

/**
 * Short-lived, purpose-scoped token for the registration email-verification
 * flow. Unlike the password-reset token it doesn't carry `tokenVersion` —
 * verification isn't a session-invalidating action, and re-verifying an
 * already-verified account with a stale-but-unexpired link is harmless
 * (handled as an "already verified" no-op by the caller).
 */
export function signEmailVerificationToken(userId: string): string {
  return jwt.sign({ sub: userId, purpose: "email_verification" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "24h",
  });
}

export function verifyEmailVerificationToken(token: string): EmailVerificationPayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as EmailVerificationPayload;
  if (payload.purpose !== "email_verification") {
    throw new Error("Invalid token purpose");
  }
  return payload;
}

export interface TwoFactorChallengePayload {
  sub: string;
  tokenVersion: number;
  purpose: "two_factor_challenge";
}

/**
 * Issued when a password login succeeds but the account has 2FA on — proves
 * the password step passed without granting a session. Carries
 * `tokenVersion` so a password change mid-challenge invalidates it, and
 * expires quickly since it's only meant to bridge one login screen.
 */
export function signTwoFactorChallengeToken(payload: Omit<TwoFactorChallengePayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "two_factor_challenge" }, env.JWT_ACCESS_SECRET, {
    expiresIn: "10m",
  });
}

export function verifyTwoFactorChallengeToken(token: string): TwoFactorChallengePayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TwoFactorChallengePayload;
  if (payload.purpose !== "two_factor_challenge") {
    throw new Error("Invalid token purpose");
  }
  return payload;
}

/**
 * A support-login token for the target user, stamped with the Super Admin who
 * started it. Deliberately short-lived and never paired with a refresh token,
 * so an impersonation session always dies on its own rather than lingering.
 */
export function signImpersonationToken(payload: JwtPayload & { impersonatedBy: string }): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: IMPERSONATION_TOKEN_TTL });
}
