import { api } from "./client";
import type { ApiPurchase, ProductCostHistory, PurchaseStatus, PurchaseTraceability } from "@/types/api";

/**
 * A single custom cost on a purchase: whatever the person recording it wants
 * to call it, plus an amount, an optional note and an optional receipt photo.
 * Deliberately no category/type field — the backend has no enum to match.
 */
export interface CostItemPayload {
  name: string;
  amountBDT: number;
  note?: string;
  proof?: File | null;
}

export interface CreatePurchasePayload {
  product?: string;
  variantId?: string;
  itemName?: string;
  supplierName?: string;
  purchasedAt?: string;
  quantity: number;
  unit?: string;
  productCostBDT: number;
  note?: string;
  costItems?: CostItemPayload[];
}

export interface ListPurchasesParams {
  product?: string;
  status?: PurchaseStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listPurchases(params: ListPurchasesParams = {}) {
  const search = new URLSearchParams();
  if (params.product) search.set("product", params.product);
  if (params.status) search.set("status", params.status);
  if (params.search) search.set("search", params.search);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return api.get<{ purchases: ApiPurchase[] }>(`/purchases${qs ? `?${qs}` : ""}`);
}

export async function getPurchase(id: string) {
  return api.get<{ purchase: ApiPurchase }>(`/purchases/${id}`);
}

/**
 * Sent as multipart so any up-front cost items can carry their receipt
 * image. Each item's file goes under `costProof<index>` so an item without a
 * receipt does not shift the later ones onto the wrong index.
 */
export async function createPurchase(payload: CreatePurchasePayload) {
  const form = new FormData();
  if (payload.product) form.set("product", payload.product);
  if (payload.variantId) form.set("variantId", payload.variantId);
  if (payload.itemName) form.set("itemName", payload.itemName);
  if (payload.supplierName) form.set("supplierName", payload.supplierName);
  if (payload.purchasedAt) form.set("purchasedAt", payload.purchasedAt);
  form.set("quantity", String(payload.quantity));
  if (payload.unit) form.set("unit", payload.unit);
  form.set("productCostBDT", String(payload.productCostBDT));
  if (payload.note) form.set("note", payload.note);

  const items = payload.costItems ?? [];
  form.set(
    "costItems",
    JSON.stringify(items.map(({ name, amountBDT, note }) => ({ name, amountBDT, note })))
  );
  items.forEach((item, index) => {
    if (item.proof) form.set(`costProof${index}`, item.proof);
  });

  return api.postForm<{ purchase: ApiPurchase }>("/purchases", form);
}

export interface UpdatePurchasePayload {
  itemName?: string;
  supplierName?: string;
  purchasedAt?: string;
  quantity?: number;
  unit?: string;
  productCostBDT?: number;
  note?: string;
}

export async function updatePurchase(id: string, payload: UpdatePurchasePayload) {
  return api.patch<{ purchase: ApiPurchase }>(`/purchases/${id}`, payload);
}

function costItemForm(item: CostItemPayload): FormData {
  const form = new FormData();
  form.set("name", item.name);
  form.set("amountBDT", String(item.amountBDT));
  if (item.note) form.set("note", item.note);
  if (item.proof) form.set("proof", item.proof);
  return form;
}

export async function addCostItem(purchaseId: string, item: CostItemPayload) {
  return api.postForm<{ purchase: ApiPurchase }>(`/purchases/${purchaseId}/costs`, costItemForm(item));
}

export async function updateCostItem(purchaseId: string, costId: string, item: CostItemPayload) {
  return api.patchForm<{ purchase: ApiPurchase }>(
    `/purchases/${purchaseId}/costs/${costId}`,
    costItemForm(item)
  );
}

export async function removeCostItem(purchaseId: string, costId: string) {
  return api.delete<{ purchase: ApiPurchase }>(`/purchases/${purchaseId}/costs/${costId}`);
}

/** Resolves with `pendingActionId` set when the stock half went to the approval queue. */
export async function receivePurchase(id: string, note?: string) {
  return api.patch<{ purchase: ApiPurchase; pendingActionId?: string }>(`/purchases/${id}/receive`, {
    note,
  });
}

export async function cancelPurchase(id: string) {
  return api.patch<{ purchase: ApiPurchase }>(`/purchases/${id}/cancel`, {});
}

export async function deletePurchase(id: string) {
  return api.delete<null>(`/purchases/${id}`);
}

export async function getProductCostHistory(productId: string) {
  return api.get<ProductCostHistory>(`/purchases/product/${productId}`);
}

/** Every stock movement and order that drew on this specific batch. */
export async function getPurchaseTraceability(id: string) {
  return api.get<PurchaseTraceability>(`/purchases/${id}/traceability`);
}
