import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { paramStr } from "../utils/params";
import { actorOf } from "../utils/actor";
import * as userService from "../services/user.service";

export const createStaff = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.createStaffAccount(req.body);
  sendSuccess(res, 201, "Staff account created", { user });
});

export const listUsers = catchAsync(async (req: Request, res: Response) => {
  const { role, search, isActive, isEmailVerified, page, limit } = req.query as unknown as {
    role?: import("../constants/roles").Role;
    search?: string;
    isActive?: boolean;
    isEmailVerified?: boolean;
    page: number;
    limit: number;
  };
  const { users, pagination } = await userService.listUsers({
    role,
    search,
    isActive,
    isEmailVerified,
    page,
    limit,
  });
  sendSuccess(res, 200, "Users fetched", { users }, { pagination });
});

export const getCustomerStats = catchAsync(async (_req: Request, res: Response) => {
  const stats = await userService.getCustomerStats();
  sendSuccess(res, 200, "Customer stats fetched", stats);
});

export const getUser = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.getUserById(paramStr(req.params.id));
  sendSuccess(res, 200, "User fetched", { user });
});

export const updateRole = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateUserRole(paramStr(req.params.id), req.body.role, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Role updated", { user });
});

export const updateStatus = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateUserStatus(paramStr(req.params.id), req.body.isActive, {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Status updated", { user });
});

export const updateStaffMeta = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateStaffMeta(paramStr(req.params.id), req.body);
  sendSuccess(res, 200, "Staff details updated", { user });
});

export const uploadStaffNidImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("An NID card image is required");
  const user = await userService.updateStaffNidImage(paramStr(req.params.id), req.file, actorOf(req));
  sendSuccess(res, 200, "NID card image updated", { user });
});

export const unlockAccount = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.unlockUserAccount(paramStr(req.params.id), {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, "Account unlocked", { user });
});

export const impersonate = catchAsync(async (req: Request, res: Response) => {
  const { accessToken, user } = await userService.impersonateUser(paramStr(req.params.id), {
    id: req.user!.id,
    role: req.user!.role,
  });
  sendSuccess(res, 200, `Now acting as ${user.name}`, { accessToken, user });
});

export const addAddress = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.addAddress(req.user!.id, req.body);
  sendSuccess(res, 201, "Address added", { user });
});

export const updateMyAddress = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateAddress(req.user!.id, paramStr(req.params.addressId), req.body);
  sendSuccess(res, 200, "Address updated", { user });
});

export const removeAddress = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.removeAddress(req.user!.id, paramStr(req.params.addressId));
  sendSuccess(res, 200, "Address removed", { user });
});

export const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.updateMyProfile(req.user!.id, req.body);
  sendSuccess(res, 200, "Profile updated", { user });
});

export const updateMyAvatar = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) throw ApiError.badRequest("A profile picture image is required");
  const user = await userService.updateMyAvatar(req.user!.id, req.file);
  sendSuccess(res, 200, "Profile picture updated", { user });
});

export const removeMyAvatar = catchAsync(async (req: Request, res: Response) => {
  const user = await userService.removeMyAvatar(req.user!.id);
  sendSuccess(res, 200, "Profile picture removed", { user });
});
