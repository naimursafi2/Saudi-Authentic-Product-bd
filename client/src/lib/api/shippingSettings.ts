import { api } from "./client";
import type { ApiShippingSettings } from "@/types/api";

export type UpdateShippingSettingsPayload = Partial<
  Pick<
    ApiShippingSettings,
    | "insideDhakaChargeBDT"
    | "outsideDhakaChargeBDT"
    | "expressSurchargeBDT"
    | "freeShippingEnabled"
    | "freeShippingMinOrderBDT"
    | "freeShippingAppliesToExpress"
    | "standardDeliveryDays"
    | "expressDeliveryDays"
  >
>;

/**
 * Public. Read-heavy and rarely changing, so it takes the same short
 * `revalidate` window as the rest of the site chrome — a rate edit shows up
 * within a minute, and no price depends on this value anyway (the server
 * recomputes every charged fee itself).
 */
export async function getShippingSettings() {
  return api.get<{ settings: ApiShippingSettings }>("/shipping-settings", { revalidate: 60 });
}

/** Admin / Super Admin — requires `settings.manage`. */
export async function updateShippingSettings(payload: UpdateShippingSettingsPayload) {
  return api.patch<{ settings: ApiShippingSettings }>("/shipping-settings", payload);
}
