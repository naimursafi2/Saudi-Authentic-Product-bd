import { api } from "./client";
import type { ApiOrder, ApiShippingAddress, DeliveryMethod, OrderStatus, PaymentMethod } from "@/types/api";

export interface CreateOrderPayload {
  items: { productId: string; variantId: string; quantity: number }[];
  shippingAddress: ApiShippingAddress;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
  couponCode?: string;
}

export async function createOrder(payload: CreateOrderPayload) {
  return api.post<{ order: ApiOrder }>("/orders", payload);
}

export async function listMyOrders(page = 1, limit = 20) {
  return api.get<{ orders: ApiOrder[] }>(`/orders/mine?page=${page}&limit=${limit}`);
}

/** `otp` is only present when the caller is the order's owner and it's currently `out_for_delivery`. */
export async function getOrder(id: string) {
  return api.get<{ order: ApiOrder; otp?: string }>(`/orders/${id}`);
}

export async function trackOrder(orderNumber: string, email: string) {
  const search = new URLSearchParams({ orderNumber, email });
  return api.get<{ order: ApiOrder; otp?: string }>(`/orders/track?${search.toString()}`);
}

export async function listOrders(params: { status?: OrderStatus; page?: number; limit?: number } = {}) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ orders: ApiOrder[] }>(`/orders${qs ? `?${qs}` : ""}`);
}

export async function updateOrderStatus(id: string, status: OrderStatus, note?: string) {
  return api.patch<{ order: ApiOrder }>(`/orders/${id}/status`, { status, note });
}

export async function assignAgent(id: string, agentId: string) {
  return api.patch<{ order: ApiOrder }>(`/orders/${id}/assign-agent`, { agentId });
}

// -- Delivery Agent (self-scoped) --

export async function listAssignedOrders(page = 1, limit = 20, status?: string) {
  const search = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (status) search.set("status", status);
  return api.get<{ orders: ApiOrder[] }>(`/orders/assigned-to-me?${search.toString()}`);
}

export async function updateDeliveryStatus(
  id: string,
  status: "picked_up" | "out_for_delivery",
  note?: string
) {
  return api.patch<{ order: ApiOrder }>(`/orders/${id}/delivery-status`, { status, note });
}

/** Generates and sends a fresh delivery OTP (email + SMS once a gateway is
 * configured) — call again to resend. Requires the order to already be
 * `out_for_delivery`. */
export async function sendDeliveryOtp(id: string) {
  return api.post<{ order: ApiOrder }>(`/orders/${id}/send-delivery-otp`, {});
}

/** `proofImage` is optional — a delivery agent can confirm with or without a photo. */
export async function verifyDeliveryOtp(id: string, otp: string, note?: string, proofImage?: File) {
  if (!proofImage) {
    return api.post<{ order: ApiOrder }>(`/orders/${id}/verify-otp`, { otp, note });
  }
  const formData = new FormData();
  formData.append("otp", otp);
  if (note) formData.append("note", note);
  formData.append("deliveryProofImage", proofImage);
  return api.postForm<{ order: ApiOrder }>(`/orders/${id}/verify-otp`, formData);
}

export async function markDeliveryFailed(id: string, failureReason: string, note?: string) {
  return api.patch<{ order: ApiOrder }>(`/orders/${id}/delivery-failed`, { failureReason, note });
}
