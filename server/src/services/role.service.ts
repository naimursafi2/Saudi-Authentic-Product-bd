import type { Types } from "mongoose";
import { RoleModel, type IRole } from "../models/Role.model";
import { UserModel } from "../models/User.model";
import { ROLES, type Role } from "../constants/roles";
import {
  ALL_PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  isPermission,
  type Permission,
} from "../constants/permissions";
import { ApiError } from "../utils/ApiError";
import { recordAuditLog } from "./auditLog.service";
import type { CreateRoleInput, UpdateRoleInput } from "../validators/role.validator";

/** Human-readable names for the seeded system roles. */
const SYSTEM_ROLE_NAMES: Record<Role, string> = {
  customer: "Customer",
  employee: "Employee",
  delivery_agent: "Delivery Agent",
  co_admin: "Co-Admin",
  order_manager: "Order Manager",
  admin: "Admin",
  super_admin: "Super Admin",
};

const SYSTEM_ROLE_DESCRIPTIONS: Record<Role, string> = {
  customer: "Storefront shopper. Can request refunds on their own orders.",
  employee: "Internal staff with access to the Employee Portal.",
  delivery_agent: "Courier with access only to their own assigned orders.",
  co_admin: "Trusted staff running day-to-day operations and content.",
  order_manager: "Order verification, dispatch and delivery assignment.",
  admin: "Full operational control across the Admin Portal.",
  super_admin: "Unrestricted. Always holds every permission.",
};

/**
 * In-process cache of role documents, keyed by role key.
 *
 * `authenticate` resolves permissions on every authenticated request, so
 * without this each request would cost an extra query or two. Roles change
 * rarely and only through this module, so a cache invalidated on write is
 * both correct and simple — no TTL to tune and no staleness window.
 *
 * The cache is per-process. A multi-instance deployment would see a role edit
 * take effect immediately on the instance that served it and on others only
 * after their next restart; see "Known limitations" in CLAUDE.md.
 */
const roleCache = new Map<string, IRole>();

export function invalidateRoleCache(): void {
  roleCache.clear();
}

/**
 * Lazily seeds the seven built-in roles, the same pattern `SiteSettings` and
 * `StaticPage` use. Seeding only ever *creates* — an existing system role's
 * permissions are left alone, so an admin's edits survive restarts.
 */
export async function ensureSystemRoles(): Promise<void> {
  const existing = await RoleModel.find({ isSystem: true }).select("key");
  const present = new Set(existing.map((r) => r.key));
  const missing = ROLES.filter((role) => !present.has(role.toUpperCase()));
  if (missing.length === 0) return;

  await RoleModel.insertMany(
    missing.map((role) => ({
      key: role.toUpperCase(),
      name: SYSTEM_ROLE_NAMES[role],
      description: SYSTEM_ROLE_DESCRIPTIONS[role],
      permissions:
        role === "super_admin" ? ALL_PERMISSIONS : ROLE_DEFAULT_PERMISSIONS[role],
      isSystem: true,
      isActive: true,
    })),
    { ordered: false }
  );
  invalidateRoleCache();
}

async function getRoleByKey(key: string): Promise<IRole | null> {
  const cached = roleCache.get(key);
  if (cached) return cached;
  const role = await RoleModel.findOne({ key });
  if (role) roleCache.set(key, role);
  return role;
}

async function getRoleById(id: Types.ObjectId | string): Promise<IRole | null> {
  const key = `id:${id.toString()}`;
  const cached = roleCache.get(key);
  if (cached) return cached;
  const role = await RoleModel.findById(id);
  if (role) roleCache.set(key, role);
  return role;
}

/**
 * The permissions a user actually holds: their built-in role's set, plus any
 * custom role's set on top.
 *
 * `super_admin` short-circuits to everything and never reads its document —
 * a Super Admin can't be locked out by a bad edit, and there is always one
 * account that can repair the permission tables.
 *
 * If a system role hasn't been seeded yet (fresh database, first request
 * before `ensureSystemRoles` has run) this falls back to the compiled-in
 * defaults, so authorization is never accidentally empty.
 */
export async function resolvePermissions(
  role: Role,
  customRoleId?: Types.ObjectId | null
): Promise<Permission[]> {
  if (role === "super_admin") return ALL_PERMISSIONS;

  const systemRole = await getRoleByKey(role.toUpperCase());
  const base = systemRole?.isActive
    ? (systemRole.permissions.filter(isPermission) as Permission[])
    : ROLE_DEFAULT_PERMISSIONS[role];

  if (!customRoleId) return base;

  const custom = await getRoleById(customRoleId);
  if (!custom || !custom.isActive) return base;

  return [...new Set([...base, ...custom.permissions.filter(isPermission)])];
}

export async function listRoles() {
  await ensureSystemRoles();
  const roles = await RoleModel.find().sort({ isSystem: -1, key: 1 });
  // Assignment counts let the panel warn before deleting a role in use.
  const counts = await UserModel.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { customRole: { $ne: null } } },
    { $group: { _id: "$customRole", count: { $sum: 1 } } },
  ]);
  const countByRole = new Map(counts.map((c) => [c._id?.toString(), c.count]));
  const systemCounts = await UserModel.aggregate<{ _id: Role; count: number }>([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  const countByKey = new Map(systemCounts.map((c) => [c._id.toUpperCase(), c.count]));

  return roles.map((role) => ({
    ...role.toJSON(),
    assignedUserCount: role.isSystem
      ? (countByKey.get(role.key) ?? 0)
      : (countByRole.get(role._id.toString()) ?? 0),
  }));
}

/**
 * Blocks privilege escalation: a role may only be given permissions the actor
 * already holds. Without this, an Admin with `roles.manage` could mint a role
 * carrying `approvals.manage` (Super Admin only) and assign it to themselves.
 * Super Admin holds everything, so this is a no-op for them.
 */
function assertCanGrant(actorPermissions: Permission[], requested: Permission[]) {
  const held = new Set<string>(actorPermissions);
  const overreach = requested.filter((p) => !held.has(p));
  if (overreach.length > 0) {
    throw ApiError.forbidden(
      `You cannot grant permissions you do not hold yourself: ${overreach.join(", ")}`
    );
  }
}

interface Actor {
  id: string;
  role: Role;
  permissions: Permission[];
}

export async function createRole(input: CreateRoleInput, actor: Actor) {
  assertCanGrant(actor.permissions, input.permissions);

  const key = input.key.trim().toUpperCase();
  if ((ROLES as readonly string[]).includes(key.toLowerCase())) {
    throw ApiError.conflict(
      `"${key}" is a built-in role name and cannot be reused for a custom role`
    );
  }
  if (await RoleModel.exists({ key })) {
    throw ApiError.conflict(`A role with the key "${key}" already exists`);
  }

  const role = await RoleModel.create({
    key,
    name: input.name,
    description: input.description,
    permissions: input.permissions,
    isSystem: false,
    isActive: input.isActive ?? true,
    createdBy: actor.id,
  });
  invalidateRoleCache();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "role.create",
    resource: "Role",
    resourceId: role._id.toString(),
    newValue: { key: role.key, name: role.name, permissions: role.permissions },
    note: `Created custom role ${role.key} with ${role.permissions.length} permission(s)`,
  });

  return role;
}

export async function updateRole(id: string, input: UpdateRoleInput, actor: Actor) {
  const role = await RoleModel.findById(id);
  if (!role) throw ApiError.notFound("Role not found");

  if (role.key === "SUPER_ADMIN") {
    throw ApiError.forbidden(
      "The Super Admin role always holds every permission and cannot be edited"
    );
  }

  // Editing a built-in role changes what Admin/Co-Admin/etc. can do platform
  // wide. Restricting that to Super Admin stops an Admin with `roles.manage`
  // from simply widening their own role — the escalation the grant check
  // above blocks for custom roles.
  if (role.isSystem && actor.role !== "super_admin") {
    throw ApiError.forbidden("Only a Super Admin can change a built-in role's permissions");
  }

  if (input.permissions) assertCanGrant(actor.permissions, input.permissions);

  const before = {
    name: role.name,
    description: role.description,
    permissions: [...role.permissions],
    isActive: role.isActive,
  };

  // A system role's key and name are its identity — `key` must keep matching
  // `User.role`, so neither is editable there.
  if (!role.isSystem) {
    if (input.name !== undefined) role.name = input.name;
    if (input.description !== undefined) role.description = input.description;
    if (input.isActive !== undefined) role.isActive = input.isActive;
  }
  if (input.permissions) role.permissions = input.permissions;

  await role.save();
  invalidateRoleCache();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "role.update",
    resource: "Role",
    resourceId: role._id.toString(),
    oldValue: before,
    newValue: {
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isActive: role.isActive,
    },
    note: `Updated role ${role.key}`,
  });

  return role;
}

export async function deleteRole(id: string, actor: Actor) {
  const role = await RoleModel.findById(id);
  if (!role) throw ApiError.notFound("Role not found");
  if (role.isSystem) {
    throw ApiError.forbidden("Built-in roles cannot be deleted");
  }

  const assigned = await UserModel.countDocuments({ customRole: role._id });
  if (assigned > 0) {
    throw ApiError.badRequest(
      `${assigned} user(s) still have this role. Reassign them before deleting it.`
    );
  }

  await role.deleteOne();
  invalidateRoleCache();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "role.delete",
    resource: "Role",
    resourceId: id,
    oldValue: { key: role.key, name: role.name, permissions: role.permissions },
    note: `Deleted custom role ${role.key}`,
  });
}

/**
 * Assigns (or clears, with `null`) a user's custom role. The user's built-in
 * `role` is untouched — this only ever layers permissions on top.
 */
export async function assignCustomRole(userId: string, roleId: string | null, actor: Actor) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === "super_admin") {
    throw ApiError.forbidden("A Super Admin already holds every permission");
  }

  let role: IRole | null = null;
  if (roleId) {
    role = await RoleModel.findById(roleId);
    if (!role) throw ApiError.notFound("Role not found");
    if (role.isSystem) {
      throw ApiError.badRequest(
        "Built-in roles are assigned through the user's role field, not as a custom role"
      );
    }
    // Same escalation guard as creating a role: you cannot hand someone a
    // capability you don't have yourself.
    assertCanGrant(actor.permissions, role.permissions.filter(isPermission) as Permission[]);
  }

  const previous = user.customRole?.toString() ?? null;
  user.customRole = role ? role._id : undefined;
  await user.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.customRole.update",
    resource: "User",
    resourceId: user._id.toString(),
    oldValue: { customRole: previous },
    newValue: { customRole: role?._id.toString() ?? null },
    note: role
      ? `Assigned custom role ${role.key} to ${user.email}`
      : `Cleared custom role from ${user.email}`,
  });

  return user;
}

/** The effective permission list for one user — powers the panel's
 * "what can this employee actually do?" view. */
export async function getUserPermissions(userId: string) {
  const user = await UserModel.findById(userId).select("name email role customRole");
  if (!user) throw ApiError.notFound("User not found");

  const permissions = await resolvePermissions(user.role, user.customRole);
  const customRole = user.customRole ? await getRoleById(user.customRole) : null;

  return {
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    customRole: customRole
      ? { id: customRole._id.toString(), key: customRole.key, name: customRole.name }
      : null,
    permissions,
  };
}
