import { api } from "./client";
import type { ApiOrder, ApiShippingAddress, DeliveryMethod, OrderStatus, PaymentMethod } from "@/types/api";

export interface CreateOrderPayload {
  items: { productId: string; variantId: string; quantity: number }[];
  shippingAddress: ApiShippingAddress;
  deliveryMethod: DeliveryMethod;
  paymentMethod: PaymentMethod;
}

export async function createOrder(payload: CreateOrderPayload) {
  return api.post<{ order: ApiOrder }>("/orders", payload);
}

export async function listMyOrders(page = 1, limit = 20) {
  return api.get<{ orders: ApiOrder[] }>(`/orders/mine?page=${page}&limit=${limit}`);
}

export async function getOrder(id: string) {
  return api.get<{ order: ApiOrder }>(`/orders/${id}`);
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
