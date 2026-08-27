import { api } from "./client";
import type { ApiProductAlert, ProductAlertType } from "@/types/api";

export async function subscribeToProductAlert(input: { productId: string; variantId?: string; type: ProductAlertType }) {
  return api.post<{ alert: ApiProductAlert }>("/product-alerts", input);
}

export async function listMyProductAlerts() {
  return api.get<{ alerts: ApiProductAlert[] }>("/product-alerts/mine");
}

export async function unsubscribeFromProductAlert(id: string) {
  return api.delete<null>(`/product-alerts/${id}`);
}
