import type { ShippingRates } from "../models/ShippingSettings.model";

/**
 * Shipping *rules*. The rates themselves are business configuration and live
 * in the database (`ShippingSettings`) so an administrator can change them —
 * this module only knows how to apply whatever rates it is handed.
 *
 * `computeShippingFee` is deliberately pure: it takes the rates as an argument
 * rather than reading them itself. That keeps it trivially testable against
 * any rate combination, and keeps the single authoritative call site obvious —
 * `order.service.ts#createOrder`, which awaits the live settings and computes
 * the fee server-side. The client never supplies a shipping figure.
 */

export type DeliveryMethod = "standard" | "express";

export interface ShippingFeeInput {
  deliveryMethod: DeliveryMethod;
  /** The shipping address's district, used to pick the zone rate. */
  district: string;
  /** Order subtotal *before* any coupon discount. */
  subtotalBDT: number;
}

/**
 * Zone check. Deliberately a simple name match against the one district that
 * carries its own rate, rather than a lookup table: `bdDistricts` lists Dhaka
 * exactly once, and everywhere else shares the outside-Dhaka rate. If the
 * business ever needs more than two zones, this is the single place that
 * changes — and the rate fields would move to a list on `ShippingSettings`.
 */
export function isInsideDhaka(district: string): boolean {
  return district.trim().toLowerCase() === "dhaka";
}

export function computeShippingFee(input: ShippingFeeInput, rates: ShippingRates): number {
  const baseBDT = isInsideDhaka(input.district)
    ? rates.insideDhakaChargeBDT
    : rates.outsideDhakaChargeBDT;

  const feeBDT =
    input.deliveryMethod === "express" ? baseBDT + rates.expressSurchargeBDT : baseBDT;

  // Free shipping is measured against the pre-discount subtotal, matching the
  // coupon module's own minimum-order check, so the two thresholds behave
  // consistently for the same basket.
  const qualifiesForFreeShipping =
    rates.freeShippingEnabled &&
    input.subtotalBDT >= rates.freeShippingMinOrderBDT &&
    (input.deliveryMethod === "standard" || rates.freeShippingAppliesToExpress);

  return qualifiesForFreeShipping ? 0 : feeBDT;
}

/** Calendar days to quote for a delivery method, from the configured rates. */
export function estimatedDeliveryDays(method: DeliveryMethod, rates: ShippingRates): number {
  return method === "express" ? rates.expressDeliveryDays : rates.standardDeliveryDays;
}
