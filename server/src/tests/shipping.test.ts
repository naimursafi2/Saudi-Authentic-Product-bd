import {
  computeShippingFee,
  STANDARD_SHIPPING_FEE_BDT,
  EXPRESS_SHIPPING_FEE_BDT,
  FREE_SHIPPING_THRESHOLD_BDT,
} from "../constants/shipping";

describe("computeShippingFee", () => {
  it("charges the standard fee below the free-shipping threshold", () => {
    expect(computeShippingFee("standard", FREE_SHIPPING_THRESHOLD_BDT - 1)).toBe(
      STANDARD_SHIPPING_FEE_BDT
    );
  });

  it("is free at or above the free-shipping threshold for standard delivery", () => {
    expect(computeShippingFee("standard", FREE_SHIPPING_THRESHOLD_BDT)).toBe(0);
    expect(computeShippingFee("standard", FREE_SHIPPING_THRESHOLD_BDT + 500)).toBe(0);
  });

  it("always charges the express fee regardless of subtotal", () => {
    expect(computeShippingFee("express", 0)).toBe(EXPRESS_SHIPPING_FEE_BDT);
    expect(computeShippingFee("express", FREE_SHIPPING_THRESHOLD_BDT + 500)).toBe(
      EXPRESS_SHIPPING_FEE_BDT
    );
  });
});
