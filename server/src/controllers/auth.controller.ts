import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { setAuthCookies, clearAuthCookies } from "../utils/cookies";
import * as authService from "../services/auth.service";
import { resolvePermissions } from "../services/role.service";
import { UserModel, type IUser } from "../models/User.model";

// register/login/Google sign-in used to return just the user, and the
// frontend followed up with a second `GET /auth/me` round-trip purely to
// fetch `permissions` (see AuthContext) — doubling the wait on every sign-in
// action. Since `resolvePermissions` is already computed on every subsequent
// authenticated request (auth.middleware), it's cheap to compute once more
// here and hand it back in the same response, so the client never has to ask
// twice just to render nav/permission-gated UI right after signing in.
async function withPermissions(user: IUser) {
  const permissions = await resolvePermissions(user.role, user.customRole);
  return { user, permissions };
}

export const register = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.registerCustomer(req.body);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  const { permissions } = await withPermissions(user);
  sendSuccess(res, 201, "Account created successfully", { user, accessToken: tokens.accessToken, permissions });
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken);
  const { permissions } = await withPermissions(result.user);
  sendSuccess(res, 200, "Logged in successfully", {
    user: result.user,
    accessToken: result.tokens.accessToken,
    permissions,
  });
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.googleAuth(req.body.idToken);
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
  const { permissions } = await withPermissions(user);
  sendSuccess(res, 200, "Signed in with Google", { user, accessToken: tokens.accessToken, permissions });
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
  const user = await UserModel.findById(req.user!.id).populate("customRole", "key name");
  if (!user) throw ApiError.notFound("User not found");
  // `permissions` is what the frontend hides nav and pages with. It is a
  // convenience for the UI only — the backend re-checks on every request, so
  // a tampered client gains nothing.
  sendSuccess(res, 200, "Current user", {
    user,
    permissions: req.user!.permissions,
    impersonatedBy: req.user!.impersonatedBy,
  });
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
