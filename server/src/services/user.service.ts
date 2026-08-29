import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { retireInternalAsset, uploadInternalFile, type AssetActor } from "./internalAsset.service";
import { sendStaffWelcomeEmail, sendVerificationEmail } from "./email.service";
import { recordAuditLog } from "./auditLog.service";
import { signImpersonationToken, signEmailVerificationToken } from "../utils/jwt";
import type {
  AddAddressInput,
  CreateStaffInput,
  UpdateAddressInput,
  UpdateMyProfileInput,
  UpdateStaffMetaInput,
} from "../validators/user.validator";
import type { Role } from "../constants/roles";

export async function createStaffAccount(input: CreateStaffInput) {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone,
    role: input.role,
    // Every role verifies its own email now, staff included — an admin
    // entering the address doesn't guarantee the new hire actually has
    // access to that inbox, so the same link-based flow customer
    // registration uses applies here too.
    isEmailVerified: false,
    staffMeta: input.staffMeta
      ? { ...input.staffMeta, joinedAt: input.staffMeta.joinedAt ?? new Date() }
      : undefined,
  });

  void sendStaffWelcomeEmail(user.email, user.name, {
    role: user.role,
    employeeId: user.staffMeta?.employeeId,
    temporaryPassword: input.password,
  });
  const verificationToken = signEmailVerificationToken(user._id.toString());
  void sendVerificationEmail(user.email, user.name, verificationToken);

  return user;
}

export async function updateStaffMeta(id: string, input: UpdateStaffMetaInput) {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.staffMeta) throw ApiError.badRequest("This user is not a staff account");

  Object.assign(user.staffMeta, input);
  await user.save();
  return user;
}

/** Uploads/replaces a staff member's NID card photo — same pattern as `updateMyAvatar`. */
export async function updateStaffNidImage(id: string, file: Express.Multer.File, actor: AssetActor) {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound("User not found");
  if (!user.staffMeta) throw ApiError.badRequest("This user is not a staff account");

  await retireInternalAsset(user.staffMeta.nidImage?.publicId, actor, "Staff NID image replaced");
  const uploaded = await uploadInternalFile(file, {
    folder: "saudi-authentic-product/staff-nid",
    resource: "User",
    resourceId: id,
    fieldPath: "staffMeta.nidImage",
    module: "Employees",
    actor,
  });
  user.staffMeta.nidImage = { url: uploaded.url, publicId: uploaded.publicId };
  await user.save();
  return user;
}

export async function listUsers(filter: {
  role?: Role;
  search?: string;
  isActive?: boolean;
  isEmailVerified?: boolean;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.role) query.role = filter.role;
  if (filter.isActive !== undefined) query.isActive = filter.isActive;
  if (filter.isEmailVerified !== undefined) query.isEmailVerified = filter.isEmailVerified;
  if (filter.search) {
    query.$or = [
      { name: { $regex: filter.search, $options: "i" } },
      { email: { $regex: filter.search, $options: "i" } },
    ];
  }

  const skip = (filter.page - 1) * filter.limit;
  const [users, total] = await Promise.all([
    UserModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit),
    UserModel.countDocuments(query),
  ]);

  return {
    users,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

/**
 * Backs the Customer Management page and the Campaign dashboard's "how many
 * customers do I actually have" stat cards — every number here is a live
 * `countDocuments` against the real `User` collection, never hardcoded or
 * cached, so it updates the moment a customer registers, verifies their
 * email, or is (de)activated.
 */
export async function getCustomerStats() {
  const [total, verified, active] = await Promise.all([
    UserModel.countDocuments({ role: "customer" }),
    UserModel.countDocuments({ role: "customer", isEmailVerified: true }),
    UserModel.countDocuments({ role: "customer", isActive: true }),
  ]);

  return {
    total,
    verified,
    unverified: total - verified,
    active,
    inactive: total - active,
  };
}

export async function getUserById(id: string) {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateUserRole(id: string, role: Role, actor: { id: string; role: Role }) {
  if (id === actor.id) {
    throw ApiError.badRequest("You cannot change your own role");
  }
  const before = await UserModel.findById(id);
  if (!before) throw ApiError.notFound("User not found");
  const previousRole = before.role;

  const user = await UserModel.findByIdAndUpdate(id, { role }, { new: true });
  if (!user) throw ApiError.notFound("User not found");

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.role.update",
    resource: "User",
    resourceId: id,
    oldValue: { role: previousRole },
    newValue: { role, name: user.name },
  });

  return user;
}

export async function updateUserStatus(id: string, isActive: boolean, actor: { id: string; role: Role }) {
  if (id === actor.id) {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }
  const before = await UserModel.findById(id);
  if (!before) throw ApiError.notFound("User not found");
  const previousStatus = before.isActive;

  const user = await UserModel.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!user) throw ApiError.notFound("User not found");

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.status.update",
    resource: "User",
    resourceId: id,
    oldValue: { isActive: previousStatus },
    newValue: { isActive, name: user.name },
  });

  return user;
}

/**
 * Support-login: mints a short-lived bearer token acting as `id`, stamped
 * with the Super Admin who started it. No refresh token is issued and no
 * cookies are touched — the Super Admin's own session stays intact
 * underneath, and the impersonation dies on its own when the token expires.
 * Impersonating another Super Admin is refused so the role can't be used to
 * sidestep peer accountability.
 */
export async function impersonateUser(id: string, actor: { id: string; role: Role }) {
  if (id === actor.id) throw ApiError.badRequest("You cannot impersonate yourself");

  const target = await UserModel.findById(id);
  if (!target) throw ApiError.notFound("User not found");
  if (!target.isActive) throw ApiError.badRequest("This account is deactivated");
  if (target.role === "super_admin") throw ApiError.forbidden("Super Admin accounts cannot be impersonated");

  const accessToken = signImpersonationToken({
    sub: target._id.toString(),
    role: target.role,
    tokenVersion: target.tokenVersion,
    impersonatedBy: actor.id,
  });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.impersonate.start",
    resource: "User",
    resourceId: id,
    newValue: { targetEmail: target.email, targetRole: target.role, name: target.name },
  });

  return { accessToken, user: target };
}

/** Clears a lockout applied by the failed-login limiter, without waiting it out. */
export async function unlockUserAccount(id: string, actor: { id: string; role: Role }) {
  const user = await UserModel.findById(id);
  if (!user) throw ApiError.notFound("User not found");

  user.lockedUntil = undefined;
  user.failedLoginAttempts = 0;
  await user.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.unlock",
    resource: "User",
    resourceId: id,
    newValue: { name: user.name },
  });

  return user;
}

export async function addAddress(userId: string, input: AddAddressInput) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  if (input.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }
  user.addresses.push(input);
  await user.save();
  return user;
}

export async function updateAddress(userId: string, addressId: string, input: UpdateAddressInput) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const address = user.addresses.find((a) => a._id?.toString() === addressId);
  if (!address) throw ApiError.notFound("Address not found");

  if (input.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }
  Object.assign(address, input);
  await user.save();
  return user;
}

export async function removeAddress(userId: string, addressId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  user.addresses = user.addresses.filter((a) => a._id?.toString() !== addressId);
  await user.save();
  return user;
}

export async function updateMyProfile(userId: string, input: UpdateMyProfileInput) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");
  Object.assign(user, input);
  await user.save();
  return user;
}

export async function updateMyAvatar(userId: string, file: Express.Multer.File) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  const owner: AssetActor = { id: user._id.toString(), role: user.role };
  await retireInternalAsset(user.avatar?.publicId, owner, "Avatar replaced");
  const uploaded = await uploadInternalFile(file, {
    folder: "saudi-authentic-product/avatars",
    resource: "User",
    resourceId: user._id.toString(),
    fieldPath: "avatar",
    module: "Profiles",
    actor: owner,
  });
  user.avatar = { url: uploaded.url, publicId: uploaded.publicId };
  await user.save();
  return user;
}

export async function removeMyAvatar(userId: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw ApiError.notFound("User not found");

  await retireInternalAsset(user.avatar?.publicId, { id: user._id.toString(), role: user.role }, "Avatar removed");
  user.avatar = undefined;
  await user.save();
  return user;
}
