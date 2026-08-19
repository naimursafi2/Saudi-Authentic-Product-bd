import crypto from "crypto";
import bcrypt from "bcryptjs";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { recordAuditLog } from "./auditLog.service";
import { TWO_FACTOR_RECOVERY_CODE_COUNT } from "../constants/security";
import type { Role } from "../constants/roles";

const ISSUER = "Saudi Authentic Product";

function generateRecoveryCodes(): string[] {
  return Array.from({ length: TWO_FACTOR_RECOVERY_CODE_COUNT }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  );
}

/**
 * Step 1 of enrolment: mint a secret and park it in `twoFactorPendingSecret`
 * so an abandoned setup never leaves the account half-enrolled — 2FA only
 * becomes active once `enableTwoFactor` confirms the user's authenticator
 * actually produces matching codes.
 */
export async function startTwoFactorSetup(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.twoFactorEnabled) throw ApiError.badRequest("Two-factor authentication is already enabled");

  const secret = authenticator.generateSecret();
  user.twoFactorPendingSecret = secret;
  await user.save();

  const otpauthUrl = authenticator.keyuri(user.email, ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

  return { secret, otpauthUrl, qrDataUrl };
}

export async function enableTwoFactor(userId: string, role: Role, code: string) {
  const user = await UserModel.findById(userId).select("+twoFactorPendingSecret");
  if (!user) throw ApiError.notFound("User not found");
  if (user.twoFactorEnabled) throw ApiError.badRequest("Two-factor authentication is already enabled");
  if (!user.twoFactorPendingSecret) {
    throw ApiError.badRequest("Start two-factor setup before confirming a code");
  }
  if (!authenticator.verify({ token: code, secret: user.twoFactorPendingSecret })) {
    throw ApiError.badRequest("That code is incorrect or has expired — try the current one from your app");
  }

  const recoveryCodes = generateRecoveryCodes();
  user.twoFactorSecret = user.twoFactorPendingSecret;
  user.twoFactorPendingSecret = undefined;
  user.twoFactorEnabled = true;
  user.twoFactorRecoveryCodes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c, 10)));
  await user.save();

  await recordAuditLog({
    actor: userId,
    actorRole: role,
    action: "user.2fa.enable",
    resource: "User",
    resourceId: userId,
  });

  // The only time the plaintext codes ever exist outside this function.
  return { recoveryCodes };
}

export async function disableTwoFactor(userId: string, role: Role, password: string) {
  const user = await UserModel.findById(userId).select("+password");
  if (!user) throw ApiError.notFound("User not found");
  if (!user.twoFactorEnabled) throw ApiError.badRequest("Two-factor authentication is not enabled");
  if (!(await user.comparePassword(password))) {
    throw ApiError.badRequest("Password is incorrect");
  }

  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorPendingSecret = undefined;
  user.twoFactorRecoveryCodes = [];
  await user.save();

  await recordAuditLog({
    actor: userId,
    actorRole: role,
    action: "user.2fa.disable",
    resource: "User",
    resourceId: userId,
  });
}

/**
 * Accepts either a live TOTP code or one of the single-use recovery codes. A
 * consumed recovery code is removed immediately so it can't be replayed.
 */
export async function verifyTwoFactorCode(userId: string, code: string): Promise<boolean> {
  const user = await UserModel.findById(userId).select("+twoFactorSecret +twoFactorRecoveryCodes");
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return false;

  if (authenticator.verify({ token: code, secret: user.twoFactorSecret })) return true;

  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < user.twoFactorRecoveryCodes.length; i += 1) {
    if (await bcrypt.compare(normalized, user.twoFactorRecoveryCodes[i]!)) {
      user.twoFactorRecoveryCodes.splice(i, 1);
      await user.save();
      return true;
    }
  }

  return false;
}
