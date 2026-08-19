import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies";
import * as authService from "../services/auth.service";
import * as twoFactorService from "../services/twoFactor.service";
import { UserModel } from "../models/User.model";

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.registerCustomer(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 201, "Account created successfully", { user, accessToken: tokens.accessToken });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  if (result.kind === "two-factor-required") {
    sendSuccess(res, 200, "Enter the code from your authenticator app", {
      requiresTwoFactor: true,
      challengeToken: result.challengeToken,
    });
    return;
  }
  setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
  sendSuccess(res, 200, "Logged in successfully", {
    user: result.user,
    accessToken: result.tokens.accessToken,
  });
});

export const verifyTwoFactorLogin = catchAsync(async (req: Request, res: Response) => {
  const { challengeToken, code } = req.body;
  const { user, tokens } = await authService.completeTwoFactorLogin(challengeToken, code);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 200, "Logged in successfully", { user, accessToken: tokens.accessToken });
});

export const startTwoFactorSetup = catchAsync(async (req: Request, res: Response) => {
  const setup = await twoFactorService.startTwoFactorSetup(req.user!.id);
  sendSuccess(res, 200, "Scan this code with your authenticator app", setup);
});

export const enableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  const { recoveryCodes } = await twoFactorService.enableTwoFactor(req.user!.id, req.user!.role, req.body.code);
  sendSuccess(res, 200, "Two-factor authentication is now enabled", { recoveryCodes });
});

export const disableTwoFactor = catchAsync(async (req: Request, res: Response) => {
  await twoFactorService.disableTwoFactor(req.user!.id, req.user!.role, req.body.password);
  sendSuccess(res, 200, "Two-factor authentication disabled");
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.googleAuth(req.body.idToken);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 200, "Signed in with Google", { user, accessToken: tokens.accessToken });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) throw ApiError.unauthorized("No refresh token provided");

  const { user, tokens } = await authService.refreshSession(refreshToken);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 200, "Session refreshed", { user, accessToken: tokens.accessToken });
});

export const logout = catchAsync(async (_req: Request, res: Response) => {
  clearAuthCookies(res);
  sendSuccess(res, 200, "Logged out successfully");
});

export const logoutAll = catchAsync(async (req: Request, res: Response) => {
  await authService.bumpTokenVersion(req.user!.id);
  clearAuthCookies(res);
  sendSuccess(res, 200, "Logged out of all devices");
});

export const me = catchAsync(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw ApiError.notFound("User not found");
  sendSuccess(res, 200, "Current user", { user, impersonatedBy: req.user!.impersonatedBy });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const tokens = await authService.changePassword(req.user!.id, currentPassword, newPassword);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 200, "Password updated successfully");
});

export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  sendSuccess(res, 200, "If an account exists for that email, a reset link has been sent");
});

export const resetPassword = catchAsync(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;
  await authService.resetPassword(token, newPassword);
  sendSuccess(res, 200, "Password reset successfully — you can now log in");
});

export const verifyEmail = catchAsync(async (req: Request, res: Response) => {
  const status = await authService.verifyEmail(req.body.token);
  const message =
    status === "already-verified" ? "Your email is already verified — you can log in." : "Email verified successfully.";
  sendSuccess(res, 200, message, { status });
});

export const resendVerification = catchAsync(async (req: Request, res: Response) => {
  await authService.resendVerification(req.body.email);
  sendSuccess(res, 200, "If an account with that email needs verifying, a new link has been sent.");
});
