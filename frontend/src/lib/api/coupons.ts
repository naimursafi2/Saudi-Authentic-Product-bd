import { api } from "./client";
import type { ApiCoupon, CouponDiscountType, CouponStatus } from "@/types/api";

export interface ValidateCouponResult {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  discountBDT: number;
}

export async function validateCoupon(code: string, subtotalBDT: number) {
  return api.post<ValidateCouponResult>("/coupons/validate", { code, subtotalBDT });
}

export interface ListCouponsParams {
  status?: CouponStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listCoupons(params: ListCouponsParams = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ coupons: ApiCoupon[] }>(`/coupons${qs ? `?${qs}` : ""}`);
}

export interface CouponPayload {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmountBDT?: number;
  startsAt: string;
  expiresAt: string;
  usageLimit?: number;
  isActive?: boolean;
}

/** A discount above the auto-approve threshold comes back as a pending
 * approval request instead of an immediately-created coupon — see
 * ROLES_AND_PERMISSIONS_v2.md §4 and `/admin/approvals`. */
export type CouponMutationResult = { coupon: ApiCoupon; pendingActionId?: undefined } | { coupon?: undefined; pendingActionId: string };

export async function createCoupon(payload: CouponPayload) {
  return api.post<CouponMutationResult>("/coupons", payload);
}

export async function updateCoupon(id: string, payload: Partial<CouponPayload>) {
  return api.patch<CouponMutationResult>(`/coupons/${id}`, payload);
}

export async function deleteCoupon(id: string) {
  return api.delete<null>(`/coupons/${id}`);
}
