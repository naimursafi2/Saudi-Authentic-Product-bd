import {
  ShippingSettingsModel,
  SHIPPING_SETTINGS_DEFAULTS,
  setCachedShippingRates,
  type IShippingSettings,
  type ShippingRates,
} from "../models/ShippingSettings.model";
import { recordAuditLog } from "./auditLog.service";
import type { UpdateShippingSettingsInput } from "../validators/shippingSettings.validator";
import type { Role } from "../constants/roles";

function toRates(settings: IShippingSettings): ShippingRates {
  return {
    insideDhakaChargeBDT: settings.insideDhakaChargeBDT,
    outsideDhakaChargeBDT: settings.outsideDhakaChargeBDT,
    expressSurchargeBDT: settings.expressSurchargeBDT,
    freeShippingEnabled: settings.freeShippingEnabled,
    freeShippingMinOrderBDT: settings.freeShippingMinOrderBDT,
    freeShippingAppliesToExpress: settings.freeShippingAppliesToExpress,
    standardDeliveryDays: settings.standardDeliveryDays,
    expressDeliveryDays: settings.expressDeliveryDays,
  };
}

/**
 * Singleton — lazily creates the one settings document if it doesn't exist
 * yet, so a fresh database needs no migration or seed step to take orders.
 *
 * Every read refreshes the synchronous snapshot the `Order.estimatedDeliveryDate`
 * virtual reads from (see `ShippingSettings.model.ts`). Money is never taken
 * from that snapshot: `order.service.ts` awaits this function and computes the
 * charged fee from the document it returns.
 */
export async function getShippingSettings() {
  const settings = await ShippingSettingsModel.findOneAndUpdate(
    {},
    { $setOnInsert: SHIPPING_SETTINGS_DEFAULTS },
    { upsert: true, returnDocument: "after" }
  );
  setCachedShippingRates(toRates(settings));
  return settings;
}

export async function updateShippingSettings(
  input: UpdateShippingSettingsInput,
  actor: { id: string; role: Role }
) {
  const settings = await getShippingSettings();
  const oldValue = toRates(settings);

  Object.assign(settings, input);
  await settings.save();
  setCachedShippingRates(toRates(settings));

  // Shipping rates are money: every change is attributable, per CLAUDE.md's
  // rule that a settings change an owner shouldn't be able to silently undo
  // gets an audit entry.
  await recordAuditLog({
    actor: actor.id,
    actorRole: actor.role,
    action: "shippingSettings.update",
    resource: "ShippingSettings",
    resourceId: settings._id.toString(),
    oldValue,
    newValue: input,
  });

  return settings;
}
