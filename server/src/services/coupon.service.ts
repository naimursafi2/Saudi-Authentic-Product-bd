import { CouponModel, type ICoupon } from "../models/Coupon.model";
import { ApiError } from "../utils/ApiError";
import { getApprovalSettings } from "./approvalSettings.service";
import { createPendingAction, registerPendingActionHandler } from "./pendingAction.service";
import { recordAuditLog } from "./auditLog.service";
import type { CreateCouponInput, UpdateCouponInput } from "../validators/coupon.validator";
import type { Role } from "../constants/roles";

export interface CouponActor {
  id: string;
  role: Role;
}

export type CreateCouponResult = { kind: "created"; coupon: ICoupon } | { kind: "pending"; pendingActionId: string };
export type UpdateCouponResult = { kind: "updated"; coupon: ICoupon } | { kind: "pending"; pendingActionId: string };

/**
 * Percentage discounts are gated per ROLES_AND_PERMISSIONS_v2.md §4: at/below
 * the auto-approve threshold, `co_admin`/`admin` create directly; above it
 * (and up to the Super-Admin-only threshold) the request goes through the
 * approval gate; above the Super-Admin-only threshold, only `super_admin`
 * may create/update at all. `super_admin` always bypasses the gate. Fixed
 * (non-percentage) discounts aren't addressed by the spec's threshold table,
 * so they're treated like an auto-approved (≤ threshold) request — no risk
 * metric is defined for a flat BDT amount.
 */
async function resolveCouponGate(
  actor: CouponActor,
  discountType: "percentage" | "fixed",
  discountValue: number
): Promise<"direct" | "gated" | "forbidden"> {
  if (actor.role === "super_admin") return "direct";
  if (discountType !== "percentage") return "direct";

  const settings = await getApprovalSettings();
  if (discountValue <= settings.couponAutoApprovePercent) return "direct";
  if (discountValue <= settings.couponSuperAdminOnlyAbovePercent) return "gated";
  return "forbidden";
}

export type CouponStatus = "scheduled" | "active" | "expired" | "disabled";

/**
 * Status is derived, not stored — computing it fresh against the current
 * time (rather than persisting a status field that would need a background
 * job to keep in sync) means a coupon's listed status is never stale.
 */
export function computeCouponStatus(
  coupon: Pick<ICoupon, "isActive" | "startsAt" | "expiresAt">,
  now: Date = new Date()
): CouponStatus {
  if (!coupon.isActive) return "disabled";
  if (now < coupon.startsAt) return "scheduled";
  if (now > coupon.expiresAt) return "expired";
  return "active";
}

export async function listCoupons(filter: {
  status?: CouponStatus;
  search?: string;
  page: number;
  limit: number;
}) {
  const query: Record<string, unknown> = {};
  if (filter.search) query.code = { $regex: filter.search, $options: "i" };

  const now = new Date();
  if (filter.status === "disabled") {
    query.isActive = false;
  } else if (filter.status === "scheduled") {
    Object.assign(query, { isActive: true, startsAt: { $gt: now } });
  } else if (filter.status === "active") {
    Object.assign(query, { isActive: true, startsAt: { $lte: now }, expiresAt: { $gte: now } });
  } else if (filter.status === "expired") {
    Object.assign(query, { isActive: true, expiresAt: { $lt: now } });
  }

  const skip = (filter.page - 1) * filter.limit;
  const [coupons, total] = await Promise.all([
    CouponModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit),
    CouponModel.countDocuments(query),
  ]);

  return {
    coupons,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

async function insertCoupon(input: CreateCouponInput): Promise<ICoupon> {
  const existing = await CouponModel.findOne({ code: input.code });
  if (existing) throw ApiError.conflict("A coupon with this code already exists");
  return CouponModel.create(input);
}

export async function createCoupon(input: CreateCouponInput, actor: CouponActor): Promise<CreateCouponResult> {
  const gate = await resolveCouponGate(actor, input.discountType, input.discountValue);
  if (gate === "forbidden") {
    throw ApiError.forbidden(
      "Only Super Admin can create a coupon with a discount this large — see Approval Settings for the current threshold"
    );
  }
  if (gate === "gated") {
    const action = await createPendingAction("coupon.create", { ...input }, actor);
    return { kind: "pending", pendingActionId: action._id.toString() };
  }

  const coupon = await insertCoupon(input);
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "coupon.create",
    resource: "Coupon",
    resourceId: coupon._id.toString(),
    newValue: input,
  });
  return { kind: "created", coupon };
}

async function applyCouponUpdate(id: string, input: UpdateCouponInput): Promise<ICoupon> {
  const coupon = await CouponModel.findById(id);
  if (!coupon) throw ApiError.notFound("Coupon not found");

  if (input.code && input.code !== coupon.code) {
    const existing = await CouponModel.findOne({ code: input.code });
    if (existing) throw ApiError.conflict("A coupon with this code already exists");
  }

  Object.assign(coupon, input);

  // Re-validated post-merge (not just at the zod layer) since a partial
  // update might only touch one side of a cross-field rule — e.g. changing
  // just `expiresAt` while `startsAt` keeps its existing stored value.
  if (coupon.expiresAt <= coupon.startsAt) {
    throw ApiError.badRequest("Expiry date must be after the start date");
  }
  if (coupon.discountType === "percentage" && coupon.discountValue > 100) {
    throw ApiError.badRequest("Percentage discount cannot exceed 100");
  }

  await coupon.save();
  return coupon;
}

export async function updateCoupon(
  id: string,
  input: UpdateCouponInput,
  actor: CouponActor
): Promise<UpdateCouponResult> {
  const existing = await CouponModel.findById(id);
  if (!existing) throw ApiError.notFound("Coupon not found");

  const discountType = input.discountType ?? existing.discountType;
  const discountValue = input.discountValue ?? existing.discountValue;
  const gate = await resolveCouponGate(actor, discountType, discountValue);
  if (gate === "forbidden") {
    throw ApiError.forbidden(
      "Only Super Admin can set a discount this large — see Approval Settings for the current threshold"
    );
  }
  if (gate === "gated") {
    const action = await createPendingAction("coupon.update", { id, ...input }, actor);
    return { kind: "pending", pendingActionId: action._id.toString() };
  }

  const oldValue = existing.toObject();
  const coupon = await applyCouponUpdate(id, input);
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "coupon.update",
    resource: "Coupon",
    resourceId: coupon._id.toString(),
    oldValue,
    newValue: input,
  });
  return { kind: "updated", coupon };
}

export async function deleteCoupon(id: string, actor: CouponActor) {
  const coupon = await CouponModel.findById(id);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  await coupon.deleteOne();
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "coupon.delete",
    resource: "Coupon",
    resourceId: id,
    oldValue: coupon.toObject(),
  });
}

// -- Approval-gate handlers — see pendingAction.service.ts for why this is a
// registry rather than a direct import. --
registerPendingActionHandler("coupon.create", async (payload, reviewer) => {
  const coupon = await insertCoupon(payload as unknown as CreateCouponInput);
  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "coupon.create",
    resource: "Coupon",
    resourceId: coupon._id.toString(),
    newValue: payload,
    note: "Applied via approval grant",
  });
  return { resource: "Coupon", resourceId: coupon._id.toString() };
});

registerPendingActionHandler("coupon.update", async (payload, reviewer) => {
  const { id, ...input } = payload as { id: string } & UpdateCouponInput;
  const coupon = await applyCouponUpdate(id, input);
  await recordAuditLog({
    actor: reviewer.id,
    actorRole: reviewer.role,
    action: "coupon.update",
    resource: "Coupon",
    resourceId: coupon._id.toString(),
    newValue: input,
    note: "Applied via approval grant",
  });
  return { resource: "Coupon", resourceId: coupon._id.toString() };
});

export interface CouponValidationResult {
  coupon: ICoupon;
  discountBDT: number;
}

/**
 * Re-validated from scratch on every call, against the live document and
 * the caller's own freshly-computed `subtotalBDT` — both the customer-facing
 * `/coupons/validate` preview and, critically, `order.service.ts#createOrder`
 * call this rather than trusting a client-submitted discount amount or an
 * earlier preview response.
 */
export async function validateCouponForOrder(code: string, subtotalBDT: number): Promise<CouponValidationResult> {
  const coupon = await CouponModel.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) throw ApiError.badRequest("Invalid coupon code");

  const status = computeCouponStatus(coupon);
  if (status === "disabled") throw ApiError.badRequest("This coupon is no longer active");
  if (status === "scheduled") throw ApiError.badRequest("This coupon is not active yet");
  if (status === "expired") throw ApiError.badRequest("This coupon has expired");

  if (coupon.usageLimit !== undefined && coupon.usageCount >= coupon.usageLimit) {
    throw ApiError.badRequest("This coupon has reached its usage limit");
  }
  if (subtotalBDT < coupon.minOrderAmountBDT) {
    throw ApiError.badRequest(`This coupon requires a minimum order of ৳${coupon.minOrderAmountBDT}`);
  }

  const rawDiscount =
    coupon.discountType === "percentage" ? (subtotalBDT * coupon.discountValue) / 100 : coupon.discountValue;
  const discountBDT = Math.min(Math.round(rawDiscount), subtotalBDT);

  return { coupon, discountBDT };
}

/**
 * Atomically increments usage only if the coupon hasn't hit its limit in the
 * meantime — guards against a race between two orders redeeming the last
 * remaining use of a limited coupon concurrently.
 */
export async function applyCouponUsage(couponId: string, usageLimit?: number): Promise<void> {
  const filter: Record<string, unknown> = { _id: couponId };
  if (usageLimit !== undefined) filter.usageCount = { $lt: usageLimit };

  const result = await CouponModel.updateOne(filter, { $inc: { usageCount: 1 } });
  if (result.modifiedCount === 0 && usageLimit !== undefined) {
    throw ApiError.badRequest("This coupon has reached its usage limit");
  }
}
