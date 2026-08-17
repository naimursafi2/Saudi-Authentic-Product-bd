import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { Role } from "../constants/roles";

export interface JwtPayload {
  sub: string; // user id
  role: Role;
  tokenVersion: number;
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
