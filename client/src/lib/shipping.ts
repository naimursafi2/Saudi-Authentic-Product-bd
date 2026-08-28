import type { ApiShippingSettings, DeliveryMethod } from "@/types/api";

/**
 * Mirrors `server/src/constants/shipping.ts#computeShippingFee`, kept in sync
 * manually like every other cross-app rule here (the two apps share no code).
 *
 * The *rates* are no longer duplicated — they come from `GET /shipping-settings`,
 * the same document the server charges from. Only the formula lives in both
 * places, so an admin changing a rate needs no deploy and the two sides cannot
 * drift on the numbers.
 *
 * This is display only. The backend recomputes the fee and the order total
 * from its own copy of these settings on every order, so a tampered client
 * value changes nothing about what is charged.
 */

export function isInsideDhaka(district: string): boolean {
  return district.trim().toLowerCase() === "dhaka";
}

export function computeShippingFee(
  input: { deliveryMethod: DeliveryMethod; district: string; subtotalBDT: number },
  rates: ApiShippingSettings
): number {
  const baseBDT = isInsideDhaka(input.district)
    ? rates.insideDhakaChargeBDT
    : rates.outsideDhakaChargeBDT;

  const feeBDT = input.deliveryMethod === "express" ? baseBDT + rates.expressSurchargeBDT : baseBDT;

  const qualifiesForFreeShipping =
    rates.freeShippingEnabled &&
    input.subtotalBDT >= rates.freeShippingMinOrderBDT &&
    (input.deliveryMethod === "standard" || rates.freeShippingAppliesToExpress);

  return qualifiesForFreeShipping ? 0 : feeBDT;
}

export function estimatedDeliveryDays(method: DeliveryMethod, rates: ApiShippingSettings): number {
  return method === "express" ? rates.expressDeliveryDays : rates.standardDeliveryDays;
}
