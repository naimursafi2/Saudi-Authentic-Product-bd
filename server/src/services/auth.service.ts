import crypto from "crypto";
import { UserModel, type IUser } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
  signEmailVerificationToken,
  verifyEmailVerificationToken,
} from "../utils/jwt";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendVerificationOtpEmail,
  sendAccountLockedEmail,
} from "./email.service";
import { verifyGoogleIdToken } from "../config/google";
import {
  ACCOUNT_LOCK_DURATION_MS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  INACTIVITY_ENFORCED_ROLES,
  STAFF_INACTIVITY_TIMEOUT_MS,
  REGISTRATION_OTP_TTL_MINUTES,
  MAX_REGISTRATION_OTP_ATTEMPTS,
} from "../constants/security";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";

function issueTokens(user: IUser) {
  const payload = { sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/** Random 6-digit numeric code, e.g. "042817" (leading zeros kept). */
function generateRegistrationOtp(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * Creates the account but does NOT issue session tokens/cookies yet — the
 * account only becomes usable once `verifyRegistrationOtp` confirms the code
 * just emailed to them. This is the anti-bot gate: a script can POST to this
 * endpoint all day and get a User document back, but without access to that
 * inbox it can never produce the matching code, so it never reaches a
 * working, signed-in account. A real person completes it in one extra step.
 */
export async function registerCustomer(input: RegisterInput) {
  const existingEmail = await UserModel.findOne({ email: input.email });
  if (existingEmail) {
    throw ApiError.conflict("An account with this email already exists");
  }

  if (input.phone) {
    const existingPhone = await UserModel.findOne({ phone: input.phone });
    if (existingPhone) {
      throw ApiError.conflict("An account with this phone number already exists");
    }
  }

  const otp = generateRegistrationOtp();
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
    role: "customer",
    isEmailVerified: false,
    emailVerificationOtp: otp,
    emailVerificationOtpExpires: new Date(Date.now() + REGISTRATION_OTP_TTL_MINUTES * 60 * 1000),
    emailVerificationOtpAttempts: 0,
    addresses: input.address
      ? [
          {
            label: "Home",
            fullAddress: input.address.fullAddress,
            district: input.address.district,
            cityArea: input.address.cityArea,
            phone: input.phone!,
            isDefault: true,
          },
        ]
      : [],
  });

  void sendVerificationOtpEmail(user.email, user.name, otp);

  return { user };
}

export interface RegistrationOtpResult {
  user: IUser;
  tokens: ReturnType<typeof issueTokens>;
}

/**
 * Confirms the code emailed by `registerCustomer` and, only on success,
 * issues the same session tokens `login`/`googleAuth` do — this is the
 * moment a freshly-registered account actually becomes signed-in.
 */
export async function verifyRegistrationOtp(email: string, code: string): Promise<RegistrationOtpResult> {
  const user = await UserModel.findOne({ email }).select("+emailVerificationOtp");
  if (!user) {
    throw ApiError.badRequest("Incorrect or expired code");
  }

  // Already verified (e.g. a duplicate submit, or double-clicking Verify) —
  // just sign them in as usual instead of erroring.
  if (user.isEmailVerified) {
    return { user, tokens: issueTokens(user) };
  }

  if (
    !user.emailVerificationOtp ||
    !user.emailVerificationOtpExpires ||
    user.emailVerificationOtpExpires.getTime() < Date.now()
  ) {
    throw ApiError.badRequest("This code has expired — request a new one.");
  }

  if (code.trim() !== user.emailVerificationOtp) {
    user.emailVerificationOtpAttempts += 1;
    if (user.emailVerificationOtpAttempts >= MAX_REGISTRATION_OTP_ATTEMPTS) {
      user.emailVerificationOtp = undefined;
      user.emailVerificationOtpExpires = undefined;
      user.emailVerificationOtpAttempts = 0;
      await user.save();
      throw ApiError.badRequest("Too many incorrect attempts — request a new code.");
    }
    await user.save();
    throw ApiError.badRequest(
      `Incorrect code (${MAX_REGISTRATION_OTP_ATTEMPTS - user.emailVerificationOtpAttempts} attempt(s) remaining)`
    );
  }

  user.isEmailVerified = true;
  user.emailVerificationOtp = undefined;
  user.emailVerificationOtpExpires = undefined;
  user.emailVerificationOtpAttempts = 0;
  user.lastSeenAt = new Date();
  await user.save();

  return { user, tokens: issueTokens(user) };
}

/**
 * Re-sends a fresh registration OTP, replacing any still-outstanding one.
 * Silently no-ops for an unknown email or an already-verified account,
 * mirroring `forgotPassword`'s existence-hiding behaviour.
 */
export async function resendRegistrationOtp(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user || user.isEmailVerified) return;

  const otp = generateRegistrationOtp();
  user.emailVerificationOtp = otp;
  user.emailVerificationOtpExpires = new Date(Date.now() + REGISTRATION_OTP_TTL_MINUTES * 60 * 1000);
  user.emailVerificationOtpAttempts = 0;
  await user.save();

  void sendVerificationOtpEmail(user.email, user.name, otp);
}

/**
 * Verifies a Google "Continue with Google" credential and either logs the
 * matching account in or provisions a new customer account for it — reuses
 * the same User model, JWT session tokens and cookies as password login, no
 * separate auth system. The generated password is never surfaced to the
 * user; they can set a real one later via forgot-password if they ever want
 * to sign in with a password instead of Google.
 */
export async function googleAuth(idToken: string) {
  const profile = await verifyGoogleIdToken(idToken);

  let user = await UserModel.findOne({ email: profile.email });
  if (user) {
    if (!user.isActive) {
      throw ApiError.forbidden("This account has been deactivated. Contact an administrator.");
    }
  } else {
    user = await UserModel.create({
      name: profile.name,
      email: profile.email,
      password: crypto.randomBytes(32).toString("hex"),
      role: "customer",
      // Google has already verified ownership of this email address.
      isEmailVerified: true,
      // Pre-fill the account photo from their Google profile picture so a
      // Google sign-up isn't left with the blank/initial avatar. This is a
      // hotlinked Google URL, not a Cloudinary upload, so `publicId` stays
      // "" — `retireInternalAsset` already no-ops on a falsy publicId (see
      // internalAsset.service.ts), so this never touches Cloudinary and is
      // safely overwritten if the customer later uploads or removes a real
      // photo via their profile page.
      avatar: profile.picture ? { url: profile.picture, publicId: "" } : undefined,
    });
  }

  return { user, tokens: issueTokens(user) };
}

export interface LoginResult {
  user: IUser;
  tokens: ReturnType<typeof issueTokens>;
}

/**
 * A wrong password increments `failedLoginAttempts`; hitting
 * `MAX_FAILED_LOGIN_ATTEMPTS` locks the account for
 * `ACCOUNT_LOCK_DURATION_MS`. Both counters reset on any successful password
 * check, so a legitimate user who mistypes a few times is never penalised
 * once they get in.
 */
export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await UserModel.findOne({ email: input.email }).select("+password");
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated. Contact an administrator.");
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    throw ApiError.forbidden(
      `Too many failed sign-in attempts. This account is locked for another ${minutes} minute(s).`
    );
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MS);
      user.failedLoginAttempts = 0;
      await user.save();
      void sendAccountLockedEmail(user.email, user.name, ACCOUNT_LOCK_DURATION_MS / 60000);
      throw ApiError.forbidden(
        `Too many failed sign-in attempts. This account is locked for ${ACCOUNT_LOCK_DURATION_MS / 60000} minutes.`
      );
    }
    await user.save();
    throw ApiError.unauthorized("Invalid email or password");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastSeenAt = new Date();
  await user.save();

  return { user, tokens: issueTokens(user) };
}

export async function refreshSession(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await UserModel.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }
  if (isStaffSessionIdle(user)) {
    throw ApiError.unauthorized("Signed out due to inactivity — please log in again");
  }

  user.lastSeenAt = new Date();
  await user.save();

  return { user, tokens: issueTokens(user) };
}

/** Staff-only idle-session check — see `constants/security.ts` for why
 * customers are exempt. */
export function isStaffSessionIdle(user: IUser): boolean {
  if (!INACTIVITY_ENFORCED_ROLES.includes(user.role)) return false;
  if (!user.lastSeenAt) return false;
  return Date.now() - user.lastSeenAt.getTime() > STAFF_INACTIVITY_TIMEOUT_MS;
}

/** Invalidate all existing sessions for a user (logout-all / password change). */
export async function bumpTokenVersion(userId: string) {
  await UserModel.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await UserModel.findById(userId).select("+password");
  if (!user) throw ApiError.notFound("User not found");

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw ApiError.badRequest("Current password is incorrect");

  user.password = newPassword;
  user.tokenVersion += 1; // invalidate other sessions
  await user.save();

  return issueTokens(user);
}

/**
 * Always resolves without revealing whether the email exists, to avoid
 * leaking account existence. Silently no-ops if the address isn't found.
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user) return;

  const token = signPasswordResetToken({ sub: user._id.toString(), tokenVersion: user.tokenVersion });
  void sendPasswordResetEmail(user.email, user.name, token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  let payload;
  try {
    payload = verifyPasswordResetToken(token);
  } catch {
    throw ApiError.badRequest("This password reset link is invalid or has expired");
  }

  const user = await UserModel.findById(payload.sub).select("+password");
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    throw ApiError.badRequest("This password reset link is invalid or has expired");
  }

  user.password = newPassword;
  user.tokenVersion += 1; // invalidate the reset token and all other sessions
  await user.save();
}

export type VerifyEmailResult = "verified" | "already-verified";

/**
 * Verifies a registration email-verification link. Distinguishes an
 * already-used (but still cryptographically valid) link from a genuinely
 * expired/invalid one so the frontend can show the right state — an
 * already-verified account isn't an error, it's a harmless re-click of an
 * old email.
 */
export async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  let payload;
  try {
    payload = verifyEmailVerificationToken(token);
  } catch (err) {
    if (err instanceof Error && err.name === "TokenExpiredError") {
      throw ApiError.badRequest("This verification link has expired. Please request a new one.");
    }
    throw ApiError.badRequest("This verification link is invalid.");
  }

  const user = await UserModel.findById(payload.sub);
  if (!user) {
    throw ApiError.badRequest("This verification link is invalid.");
  }
  if (user.isEmailVerified) {
    return "already-verified";
  }

  user.isEmailVerified = true;
  await user.save();
  return "verified";
}

/**
 * Always resolves without revealing whether the email exists, mirroring
 * `forgotPassword` — silently no-ops for an unknown email or an
 * already-verified account.
 */
export async function resendVerification(email: string): Promise<void> {
  const user = await UserModel.findOne({ email });
  if (!user || user.isEmailVerified) return;

  const token = signEmailVerificationToken(user._id.toString());
  void sendVerificationEmail(user.email, user.name, token);
}
