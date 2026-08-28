"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { formatBDT } from "@/lib/utils";
import { computeShippingFee } from "@/lib/shipping";
import { Button } from "@/components/ui/Button";
import type { ApiShippingSettings } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export type ShippingSettingsFormValues = Pick<
  ApiShippingSettings,
  | "insideDhakaChargeBDT"
  | "outsideDhakaChargeBDT"
  | "expressSurchargeBDT"
  | "freeShippingEnabled"
  | "freeShippingMinOrderBDT"
  | "freeShippingAppliesToExpress"
  | "standardDeliveryDays"
  | "expressDeliveryDays"
>;

function NumberField({
  label,
  hint,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <label className={labelClasses}>{label}</label>
      <input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={fieldClasses}
      />
      {hint && <p className="mt-1 text-xs text-brown-500">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded border border-green-900/15 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 accent-green-900"
      />
      <span>
        <span className="block text-sm font-semibold text-green-950">{label}</span>
        {hint && <span className="block text-xs text-brown-500">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Admin/Super Admin editor for the shipping rates the storefront quotes and
 * the order pipeline charges. Everything here is stored in `ShippingSettings`
 * and applied to the next order immediately — nothing about delivery pricing
 * is compiled into the apps any more.
 */
export function ShippingSettingsForm({
  settings,
  error,
  isSubmitting,
  onSubmit,
}: {
  settings: ApiShippingSettings;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: ShippingSettingsFormValues) => void;
}) {
  const [values, setValues] = useState<ShippingSettingsFormValues>({
    insideDhakaChargeBDT: settings.insideDhakaChargeBDT,
    outsideDhakaChargeBDT: settings.outsideDhakaChargeBDT,
    expressSurchargeBDT: settings.expressSurchargeBDT,
    freeShippingEnabled: settings.freeShippingEnabled,
    freeShippingMinOrderBDT: settings.freeShippingMinOrderBDT,
    freeShippingAppliesToExpress: settings.freeShippingAppliesToExpress,
    standardDeliveryDays: settings.standardDeliveryDays,
    expressDeliveryDays: settings.expressDeliveryDays,
  });

  function set<K extends keyof ShippingSettingsFormValues>(key: K, next: ShippingSettingsFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: next }));
  }

  // Worked examples against the values currently in the form, using the same
  // rule the server charges by — so the effect of a rate change is visible
  // before it is saved.
  const preview = { ...settings, ...values };
  const examples = [
    { label: "Inside Dhaka, standard, ৳1,000 order", district: "Dhaka", method: "standard" as const, subtotal: 1000 },
    { label: "Outside Dhaka, standard, ৳1,000 order", district: "Sylhet", method: "standard" as const, subtotal: 1000 },
    { label: "Inside Dhaka, express, ৳1,000 order", district: "Dhaka", method: "express" as const, subtotal: 1000 },
    {
      label: `Standard order at the ${formatBDT(values.freeShippingMinOrderBDT)} threshold`,
      district: "Sylhet",
      method: "standard" as const,
      subtotal: values.freeShippingMinOrderBDT,
    },
  ];

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
      className="flex flex-col gap-6 rounded-lg border border-brown-600/10 bg-surface p-6"
    >
      <div className="flex items-center gap-2 border-b border-brown-600/10 pb-4">
        <Truck size={18} className="text-green-900" />
        <h2 className="font-serif text-lg font-semibold text-green-950">Shipping &amp; Delivery</h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <NumberField
          label="Inside Dhaka (BDT)"
          value={values.insideDhakaChargeBDT}
          onChange={(v) => set("insideDhakaChargeBDT", v)}
        />
        <NumberField
          label="Outside Dhaka (BDT)"
          value={values.outsideDhakaChargeBDT}
          onChange={(v) => set("outsideDhakaChargeBDT", v)}
        />
        <NumberField
          label="Express surcharge (BDT)"
          hint="Added on top of the zone's charge."
          value={values.expressSurchargeBDT}
          onChange={(v) => set("expressSurchargeBDT", v)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <Toggle
          label="Offer free shipping"
          hint="When off, every order is charged its zone rate whatever the subtotal."
          checked={values.freeShippingEnabled}
          onChange={(v) => set("freeShippingEnabled", v)}
        />
        {values.freeShippingEnabled && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              label="Free shipping from (BDT)"
              hint="Measured on the order subtotal, before any coupon discount."
              value={values.freeShippingMinOrderBDT}
              onChange={(v) => set("freeShippingMinOrderBDT", v)}
            />
            <Toggle
              label="Include express delivery"
              hint="Off by default — express stays a paid upgrade."
              checked={values.freeShippingAppliesToExpress}
              onChange={(v) => set("freeShippingAppliesToExpress", v)}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          label="Standard delivery (days)"
          hint="Quoted to the customer as the estimated delivery date."
          min={1}
          value={values.standardDeliveryDays}
          onChange={(v) => set("standardDeliveryDays", v)}
        />
        <NumberField
          label="Express delivery (days)"
          min={1}
          value={values.expressDeliveryDays}
          onChange={(v) => set("expressDeliveryDays", v)}
        />
      </div>

      <div className="rounded border border-green-900/15 bg-cream-50 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
          What customers would be charged
        </h3>
        <ul className="flex flex-col gap-1 text-sm">
          {examples.map((example) => {
            const fee = computeShippingFee(
              { deliveryMethod: example.method, district: example.district, subtotalBDT: example.subtotal },
              preview
            );
            return (
              <li key={example.label} className="flex items-center justify-between gap-4 text-brown-600">
                <span>{example.label}</span>
                <span className="font-semibold text-green-950">
                  {fee === 0 ? "Free" : formatBDT(fee)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end border-t border-brown-600/10 pt-4">
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Shipping Settings"}
        </Button>
      </div>
    </form>
  );
}
