import { CouponModel, type ICoupon } from "../models/Coupon.model";
import { ApiError } from "../utils/ApiError";
import type { CreateCouponInput, UpdateCouponInput } from "../validators/coupon.validator";

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

export async function createCoupon(input: CreateCouponInput) {
  const existing = await CouponModel.findOne({ code: input.code });
  if (existing) throw ApiError.conflict("A coupon with this code already exists");
  return CouponModel.create(input);
}

export async function updateCoupon(id: string, input: UpdateCouponInput) {
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

export async function deleteCoupon(id: string) {
  const coupon = await CouponModel.findById(id);
  if (!coupon) throw ApiError.notFound("Coupon not found");
  await coupon.deleteOne();
}

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
