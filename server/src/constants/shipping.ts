export const STANDARD_SHIPPING_FEE_BDT = 60;
export const EXPRESS_SHIPPING_FEE_BDT = 120;
export const FREE_SHIPPING_THRESHOLD_BDT = 5000;

export function computeShippingFee(
  deliveryMethod: "standard" | "express",
  subtotalBDT: number
): number {
  if (deliveryMethod === "express") return EXPRESS_SHIPPING_FEE_BDT;
  return subtotalBDT >= FREE_SHIPPING_THRESHOLD_BDT ? 0 : STANDARD_SHIPPING_FEE_BDT;
}
