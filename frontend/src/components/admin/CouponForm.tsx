"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ApiCoupon, CouponDiscountType } from "@/types/api";

const fieldClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3 py-2 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
const labelClasses = "mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600";

export interface CouponFormValues {
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: string;
  minOrderAmountBDT: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  isActive: boolean;
}

/** `Date` <-> the `datetime-local` input's `YYYY-MM-DDTHH:mm` value, in the browser's local timezone. */
function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultValues(initial?: ApiCoupon): CouponFormValues {
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  return {
    code: initial?.code ?? "",
    description: initial?.description ?? "",
    discountType: initial?.discountType ?? "percentage",
    discountValue: initial ? String(initial.discountValue) : "",
    minOrderAmountBDT: initial ? String(initial.minOrderAmountBDT) : "0",
    startsAt: toDatetimeLocal(initial?.startsAt) || toDatetimeLocal(now.toISOString()),
    expiresAt: toDatetimeLocal(initial?.expiresAt) || toDatetimeLocal(inAWeek.toISOString()),
    usageLimit: initial?.usageLimit ? String(initial.usageLimit) : "",
    isActive: initial?.isActive ?? true,
  };
}

export function CouponForm({
  initial,
  error,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  initial?: ApiCoupon;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: (values: CouponFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CouponFormValues>(() => defaultValues(initial));

  function update<K extends keyof CouponFormValues>(key: K, value: CouponFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className={labelClasses}>Coupon Code *</label>
        <input
          required
          value={values.code}
          onChange={(e) => update("code", e.target.value.toUpperCase())}
          placeholder="e.g. WELCOME10"
          className={fieldClasses}
        />
      </div>
      <div>
        <label className={labelClasses}>Description</label>
        <input
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Internal note about this coupon"
          className={fieldClasses}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Discount Type *</label>
          <select
            required
            value={values.discountType}
            onChange={(e) => update("discountType", e.target.value as CouponDiscountType)}
            className={fieldClasses}
          >
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (৳)</option>
          </select>
        </div>
        <div>
          <label className={labelClasses}>
            Discount Value * {values.discountType === "percentage" ? "(%)" : "(৳)"}
          </label>
          <input
            required
            type="number"
            min={0}
            max={values.discountType === "percentage" ? 100 : undefined}
            value={values.discountValue}
            onChange={(e) => update("discountValue", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Minimum Order Amount (৳)</label>
          <input
            type="number"
            min={0}
            value={values.minOrderAmountBDT}
            onChange={(e) => update("minOrderAmountBDT", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Usage Limit</label>
          <input
            type="number"
            min={1}
            placeholder="Unlimited"
            value={values.usageLimit}
            onChange={(e) => update("usageLimit", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClasses}>Starts At *</label>
          <input
            required
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => update("startsAt", e.target.value)}
            className={fieldClasses}
          />
        </div>
        <div>
          <label className={labelClasses}>Expires At *</label>
          <input
            required
            type="datetime-local"
            value={values.expiresAt}
            onChange={(e) => update("expiresAt", e.target.value)}
            className={fieldClasses}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-green-950">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(e) => update("isActive", e.target.checked)}
          className="size-4 accent-green-900"
        />
        Enabled
      </label>

      {error && <p className="text-sm text-[#8a4a3f]">{error}</p>}

      <div className="flex justify-end gap-3 border-t border-brown-600/10 pt-4">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initial ? "Save Changes" : "Create Coupon"}
        </Button>
      </div>
    </form>
  );
}
