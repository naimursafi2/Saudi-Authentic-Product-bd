import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import { ApiError } from "../utils/ApiError";
import * as roleService from "../services/role.service";
import { PERMISSION_GROUPS, PERMISSIONS, SENSITIVE_PERMISSIONS } from "../constants/permissions";
import type { Permission } from "../constants/permissions";
import type { Role } from "../constants/roles";

/** Narrows `req.user` into the shape role.service's guards expect. */
function actorFrom(req: Request): { id: string; role: Role; permissions: Permission[] } {
  if (!req.user) throw ApiError.unauthorized("You must be logged in to perform this action");
  return {
    id: req.user.id,
    role: req.user.role,
    permissions: (req.user.permissions ?? []) as Permission[],
  };
}

/** The full permission catalogue, grouped and labelled for the admin panel. */
export const listPermissions = catchAsync(async (_req: Request, res: Response) => {
  sendSuccess(res, 200, "Permissions fetched", {
    permissions: PERMISSIONS,
    groups: PERMISSION_GROUPS,
    sensitive: SENSITIVE_PERMISSIONS,
  });
});

export const listRoles = catchAsync(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles();
  sendSuccess(res, 200, "Roles fetched", { roles });
});

export const createRole = catchAsync(async (req: Request, res: Response) => {
  const role = await roleService.createRole(req.body, actorFrom(req));
  sendSuccess(res, 201, "Role created", { role });
});

export const updateRole = catchAsync(async (req: Request, res: Response) => {
  const role = await roleService.updateRole(paramStr(req.params.id), req.body, actorFrom(req));
  sendSuccess(res, 200, "Role updated", { role });
});

export const deleteRole = catchAsync(async (req: Request, res: Response) => {
  await roleService.deleteRole(paramStr(req.params.id), actorFrom(req));
  sendSuccess(res, 200, "Role deleted");
});

export const assignRole = catchAsync(async (req: Request, res: Response) => {
  const user = await roleService.assignCustomRole(
    paramStr(req.params.userId),
    req.body.roleId,
    actorFrom(req)
  );
  sendSuccess(res, 200, "Role assigned", { user });
});

export const getUserPermissions = catchAsync(async (req: Request, res: Response) => {
  const data = await roleService.getUserPermissions(paramStr(req.params.userId));
  sendSuccess(res, 200, "User permissions fetched", data);
});
