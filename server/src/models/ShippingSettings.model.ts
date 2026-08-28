import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Singleton — always exactly one document, the same lazily-created pattern as
 * `SiteSettings`/`ApprovalSettings`. Holds every commercial shipping rule the
 * storefront and the order pipeline charge against, so a rate change is an
 * edit in the admin panel rather than a code deploy.
 *
 * The defaults below reproduce the rates this project shipped with as literal
 * constants (৳60 standard anywhere, ৳120 express, free standard delivery over
 * ৳5,000), so adopting this model changes no prices until an administrator
 * actually edits them.
 */
export interface IShippingSettings extends Document {
  _id: Types.ObjectId;
  /** Base charge for an order delivered inside Dhaka. */
  insideDhakaChargeBDT: number;
  /** Base charge for an order delivered anywhere else in Bangladesh. */
  outsideDhakaChargeBDT: number;
  /** Added on top of the zone's base charge when the customer picks express delivery. */
  expressSurchargeBDT: number;
  /** Master switch — when off, no order qualifies for free shipping whatever the subtotal. */
  freeShippingEnabled: boolean;
  /** Order subtotal (before discount) at or above which shipping becomes free. */
  freeShippingMinOrderBDT: number;
  /** Whether an express order can also qualify for free shipping. Off by default: express is a paid upgrade. */
  freeShippingAppliesToExpress: boolean;
  /** Calendar days quoted to the customer as the standard delivery estimate. */
  standardDeliveryDays: number;
  /** Calendar days quoted for express delivery. */
  expressDeliveryDays: number;
  createdAt: Date;
  updatedAt: Date;
}

/** The editable rate fields, without the Mongoose document machinery. */
export type ShippingRates = Pick<
  IShippingSettings,
  | "insideDhakaChargeBDT"
  | "outsideDhakaChargeBDT"
  | "expressSurchargeBDT"
  | "freeShippingEnabled"
  | "freeShippingMinOrderBDT"
  | "freeShippingAppliesToExpress"
  | "standardDeliveryDays"
  | "expressDeliveryDays"
>;

export const SHIPPING_SETTINGS_DEFAULTS: ShippingRates = {
  // Both zones default to the single flat ৳60 this project charged before
  // shipping became configurable — deliberately identical, so introducing the
  // inside/outside split does not silently reprice existing customers.
  insideDhakaChargeBDT: 60,
  outsideDhakaChargeBDT: 60,
  // 60 base + 60 surcharge = the ৳120 express fee that was hardcoded before.
  expressSurchargeBDT: 60,
  freeShippingEnabled: true,
  freeShippingMinOrderBDT: 5000,
  freeShippingAppliesToExpress: false,
  standardDeliveryDays: 5,
  expressDeliveryDays: 2,
};

const shippingSettingsSchema = new Schema<IShippingSettings>(
  {
    insideDhakaChargeBDT: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.insideDhakaChargeBDT, min: 0 },
    outsideDhakaChargeBDT: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.outsideDhakaChargeBDT, min: 0 },
    expressSurchargeBDT: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.expressSurchargeBDT, min: 0 },
    freeShippingEnabled: { type: Boolean, default: SHIPPING_SETTINGS_DEFAULTS.freeShippingEnabled },
    freeShippingMinOrderBDT: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.freeShippingMinOrderBDT, min: 0 },
    freeShippingAppliesToExpress: {
      type: Boolean,
      default: SHIPPING_SETTINGS_DEFAULTS.freeShippingAppliesToExpress,
    },
    standardDeliveryDays: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.standardDeliveryDays, min: 1, max: 90 },
    expressDeliveryDays: { type: Number, default: SHIPPING_SETTINGS_DEFAULTS.expressDeliveryDays, min: 1, max: 90 },
  },
  { timestamps: true }
);

export const ShippingSettingsModel: Model<IShippingSettings> = model<IShippingSettings>(
  "ShippingSettings",
  shippingSettingsSchema
);

/**
 * In-process snapshot of the current rates.
 *
 * This exists for exactly one caller: `Order.model.ts`'s
 * `estimatedDeliveryDate` virtual, which Mongoose runs synchronously on every
 * order read and so cannot await a database lookup. The cache is filled and
 * invalidated by `shippingSettings.service.ts` on read and on every write.
 *
 * It is **never** the source of truth for money. Every shipping fee that is
 * actually charged is computed in `order.service.ts` from a freshly awaited
 * `getShippingSettings()`, so a stale or cold cache can only ever make a
 * delivery-date estimate briefly out of date — never mischarge an order. Per
 * the same caveat as the role/permission cache, it is per-process: a
 * multi-instance deploy fills each instance's copy on its own first read.
 */
let cachedRates: ShippingRates = { ...SHIPPING_SETTINGS_DEFAULTS };

export function getCachedShippingRates(): ShippingRates {
  return cachedRates;
}

export function setCachedShippingRates(rates: ShippingRates): void {
  cachedRates = { ...rates };
}

/** Exposed for tests — drops back to the compiled-in defaults. */
export function resetCachedShippingRates(): void {
  cachedRates = { ...SHIPPING_SETTINGS_DEFAULTS };
}
