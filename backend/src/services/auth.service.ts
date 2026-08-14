import { UserModel, type IUser } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signPasswordResetToken,
  verifyPasswordResetToken,
} from "../utils/jwt";
import { sendPasswordResetEmail } from "./email.service";
import type { LoginInput, RegisterInput } from "../validators/auth.validator";

function issueTokens(user: IUser) {
  const payload = { sub: user._id.toString(), role: user.role, tokenVersion: user.tokenVersion };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

export async function registerCustomer(input: RegisterInput) {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
    role: "customer",
  });

  return { user, tokens: issueTokens(user) };
}

export async function login(input: LoginInput) {
  const user = await UserModel.findOne({ email: input.email }).select("+password");
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) {
    throw ApiError.forbidden("This account has been deactivated. Contact an administrator.");
  }

  const isMatch = await user.comparePassword(input.password);
  if (!isMatch) {
    throw ApiError.unauthorized("Invalid email or password");
  }

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

  return { user, tokens: issueTokens(user) };
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
