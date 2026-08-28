import { computeShippingFee, isInsideDhaka, estimatedDeliveryDays } from "../constants/shipping";
import { SHIPPING_SETTINGS_DEFAULTS, type ShippingRates } from "../models/ShippingSettings.model";

/** The defaults reproduce the rates this project charged before they were configurable. */
const defaults = SHIPPING_SETTINGS_DEFAULTS;

function rates(overrides: Partial<ShippingRates> = {}): ShippingRates {
  return { ...defaults, ...overrides };
}

describe("isInsideDhaka", () => {
  it("matches the Dhaka district regardless of casing or padding", () => {
    expect(isInsideDhaka("Dhaka")).toBe(true);
    expect(isInsideDhaka("  dhaka ")).toBe(true);
  });

  it("treats every other district as outside Dhaka", () => {
    expect(isInsideDhaka("Chattogram")).toBe(false);
    expect(isInsideDhaka("")).toBe(false);
  });
});

describe("computeShippingFee", () => {
  it("reproduces the previously hardcoded rates with the default settings", () => {
    // Standard below the threshold: the old flat ৳60, in either zone.
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 1000 }, defaults)).toBe(60);
    expect(
      computeShippingFee({ deliveryMethod: "standard", district: "Sylhet", subtotalBDT: 1000 }, defaults)
    ).toBe(60);
    // Express: the old flat ৳120 (base + surcharge).
    expect(computeShippingFee({ deliveryMethod: "express", district: "Dhaka", subtotalBDT: 1000 }, defaults)).toBe(120);
    // Free standard delivery at or above ৳5,000; express still charged.
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 5000 }, defaults)).toBe(0);
    expect(computeShippingFee({ deliveryMethod: "express", district: "Dhaka", subtotalBDT: 9000 }, defaults)).toBe(120);
  });

  it("charges each zone its own configured rate", () => {
    const zoned = rates({ insideDhakaChargeBDT: 50, outsideDhakaChargeBDT: 130 });
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 100 }, zoned)).toBe(50);
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Khulna", subtotalBDT: 100 }, zoned)).toBe(130);
  });

  it("adds the express surcharge on top of the zone's base rate", () => {
    const zoned = rates({ insideDhakaChargeBDT: 50, outsideDhakaChargeBDT: 130, expressSurchargeBDT: 70 });
    expect(computeShippingFee({ deliveryMethod: "express", district: "Dhaka", subtotalBDT: 100 }, zoned)).toBe(120);
    expect(computeShippingFee({ deliveryMethod: "express", district: "Khulna", subtotalBDT: 100 }, zoned)).toBe(200);
  });

  it("charges shipping on every order when free shipping is switched off", () => {
    const off = rates({ freeShippingEnabled: false });
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 999999 }, off)).toBe(60);
  });

  it("honours a changed free-shipping threshold", () => {
    const low = rates({ freeShippingMinOrderBDT: 1000 });
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 999 }, low)).toBe(60);
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 1000 }, low)).toBe(0);
  });

  it("only makes express free when that is explicitly enabled", () => {
    expect(
      computeShippingFee({ deliveryMethod: "express", district: "Dhaka", subtotalBDT: 9000 }, defaults)
    ).toBe(120);
    expect(
      computeShippingFee(
        { deliveryMethod: "express", district: "Dhaka", subtotalBDT: 9000 },
        rates({ freeShippingAppliesToExpress: true })
      )
    ).toBe(0);
  });

  it("never returns a negative fee for a zero-rate zone", () => {
    const freeZone = rates({ insideDhakaChargeBDT: 0, freeShippingEnabled: false });
    expect(computeShippingFee({ deliveryMethod: "standard", district: "Dhaka", subtotalBDT: 10 }, freeZone)).toBe(0);
  });
});

describe("estimatedDeliveryDays", () => {
  it("reads each method's configured day count", () => {
    expect(estimatedDeliveryDays("standard", defaults)).toBe(5);
    expect(estimatedDeliveryDays("express", defaults)).toBe(2);
    const custom = rates({ standardDeliveryDays: 7, expressDeliveryDays: 1 });
    expect(estimatedDeliveryDays("standard", custom)).toBe(7);
    expect(estimatedDeliveryDays("express", custom)).toBe(1);
  });
});
