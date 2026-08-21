import { ShopModel, type IShop } from "../models/Shop.model";
import { PurchaseModel } from "../models/Purchase.model";
import { UserModel } from "../models/User.model";
import { ApiError } from "../utils/ApiError";
import { recordAuditLog } from "./auditLog.service";
import type { Role } from "../constants/roles";
import type { Permission } from "../constants/permissions";
import type { AssignShopsInput, CreateShopInput, UpdateShopInput } from "../validators/shop.validator";

export interface ShopActor {
  id: string;
  role: Role;
  permissions: Permission[];
}

/**
 * Who sees every shop, and who is limited to their own assignment.
 *
 * `super_admin` is unrestricted by construction (it holds every permission
 * and can never be locked out); anyone else needs `shops.manage`, which is
 * the permission that lets a role create and assign shops in the first place
 * — being able to hand out a shop but not see it would be incoherent.
 * Everything else — Co-Admin included — is scoped to `User.assignedShops`.
 */
export function hasUnrestrictedShopAccess(actor: ShopActor): boolean {
  return actor.role === "super_admin" || actor.permissions.includes("shops.manage");
}

/**
 * The shop ids an actor may read or write, or `null` for "no restriction".
 * Returning an empty array is meaningful and different from `null`: a scoped
 * actor with no assignment sees nothing rather than everything, so forgetting
 * to assign a shop fails closed.
 */
export async function resolveShopScope(actor: ShopActor): Promise<string[] | null> {
  if (hasUnrestrictedShopAccess(actor)) return null;
  const user = await UserModel.findById(actor.id).select("assignedShops");
  return (user?.assignedShops ?? []).map((id) => id.toString());
}

/** Throws unless the actor is allowed to touch this shop. */
export async function assertShopAccess(actor: ShopActor, shopId: string): Promise<void> {
  const scope = await resolveShopScope(actor);
  if (scope === null) return;
  if (!scope.includes(shopId)) {
    throw ApiError.forbidden("You do not have access to this shop");
  }
}

export async function listShops(actor: ShopActor, includeInactive: boolean) {
  const query: Record<string, unknown> = {};
  if (!includeInactive) query.isActive = true;

  const scope = await resolveShopScope(actor);
  if (scope !== null) query._id = { $in: scope };

  return ShopModel.find(query).sort({ name: 1 });
}

export async function createShop(input: CreateShopInput, actor: ShopActor): Promise<IShop> {
  const existing = await ShopModel.findOne({ code: input.code.toUpperCase() });
  if (existing) throw ApiError.conflict("A shop with this code already exists");

  const shop = await ShopModel.create({ ...input, createdBy: actor.id });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "shop.create",
    resource: "Shop",
    resourceId: shop._id.toString(),
    newValue: { name: shop.name, code: shop.code, isActive: shop.isActive },
  });

  return shop;
}

export async function updateShop(id: string, input: UpdateShopInput, actor: ShopActor): Promise<IShop> {
  const shop = await ShopModel.findById(id);
  if (!shop) throw ApiError.notFound("Shop not found");

  if (input.code && input.code.toUpperCase() !== shop.code) {
    const clash = await ShopModel.findOne({ code: input.code.toUpperCase(), _id: { $ne: shop._id } });
    if (clash) throw ApiError.conflict("A shop with this code already exists");
  }

  const before = { name: shop.name, code: shop.code, location: shop.location, isActive: shop.isActive };
  Object.assign(shop, input);
  await shop.save();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "shop.update",
    resource: "Shop",
    resourceId: shop._id.toString(),
    oldValue: before,
    newValue: { name: shop.name, code: shop.code, location: shop.location, isActive: shop.isActive },
  });

  return shop;
}

/**
 * A shop is only removable while nothing references it. Purchases carry the
 * cost history the whole module exists to preserve, so deleting their shop
 * out from under them is never the right move — deactivate it instead.
 */
export async function deleteShop(id: string, actor: ShopActor): Promise<void> {
  const shop = await ShopModel.findById(id);
  if (!shop) throw ApiError.notFound("Shop not found");

  const purchaseCount = await PurchaseModel.countDocuments({ shop: shop._id });
  if (purchaseCount > 0) {
    throw ApiError.badRequest(
      `This shop has ${purchaseCount} purchase${purchaseCount === 1 ? "" : "s"} recorded against it. Deactivate it instead of deleting it.`
    );
  }

  const assignedCount = await UserModel.countDocuments({ assignedShops: shop._id });
  if (assignedCount > 0) {
    throw ApiError.badRequest(
      `This shop is still assigned to ${assignedCount} staff member${assignedCount === 1 ? "" : "s"}. Unassign it first.`
    );
  }

  await shop.deleteOne();

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "shop.delete",
    resource: "Shop",
    resourceId: id,
    oldValue: { name: shop.name, code: shop.code },
  });
}

/** The shops one staff member is assigned to, for the assignment UI. */
export async function getUserShops(userId: string) {
  const user = await UserModel.findById(userId).select("name email role assignedShops").populate({
    path: "assignedShops",
    select: "name code isActive",
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

/**
 * Replaces a staff member's shop assignment wholesale. Only roles holding
 * `shops.manage` reach this (see the route), so an actor can never widen
 * their own scope by assigning themselves a shop they cannot already see.
 */
export async function assignShopsToUser(userId: string, input: AssignShopsInput, actor: ShopActor) {
  const user = await UserModel.findById(userId).select("name email role assignedShops");
  if (!user) throw ApiError.notFound("User not found");

  if (input.shopIds.length > 0) {
    const found = await ShopModel.countDocuments({ _id: { $in: input.shopIds } });
    if (found !== new Set(input.shopIds).size) {
      throw ApiError.badRequest("One or more shops could not be found");
    }
  }

  const before = user.assignedShops.map((id) => id.toString());
  // findByIdAndUpdate rather than doc.save() — the document was loaded
  // without its (select: false) password field, and the project's other
  // staff-field updates use the same call for that reason.
  await UserModel.findByIdAndUpdate(userId, { assignedShops: input.shopIds });

  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "user.shops.assign",
    resource: "User",
    resourceId: userId,
    oldValue: { assignedShops: before },
    newValue: { assignedShops: input.shopIds },
    note: `Shop assignment updated for ${user.email}`,
  });

  return getUserShops(userId);
}
