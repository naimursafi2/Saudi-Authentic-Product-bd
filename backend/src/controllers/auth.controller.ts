import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies";
import * as authService from "../services/auth.service";
import { UserModel } from "../models/User.model";

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.registerCustomer(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 201, "Account created successfully", { user, accessToken: tokens.accessToken });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  sendSuccess(res, 200, "Logged in successfully", { user, accessToken: tokens.accessToken });
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
  sendSuccess(res, 200, "Current user", { user });
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
