"use client";

import { useEffect, useState } from "react";
import { getShippingSettings } from "@/lib/api/shippingSettings";
import { formatBDT } from "@/lib/utils";
import type { ApiShippingSettings } from "@/types/api";

/**
 * The storefront's delivery promise, built from the admin-editable shipping
 * settings rather than from copy with the rate baked into it. Both the product
 * page's sidebar and its Delivery & Returns panel render this, so a rate or
 * lead-time change in the admin panel updates every mention at once.
 *
 * Both instances sit on the same page, so the in-flight request is shared
 * module-wide rather than fired twice.
 */
let inFlight: Promise<ApiShippingSettings | null> | null = null;

function loadShippingSettings(): Promise<ApiShippingSettings | null> {
  if (!inFlight) {
    inFlight = getShippingSettings()
      .then(({ data }) => data.settings)
      .catch(() => null);
  }
  return inFlight;
}

export function useShippingSettings(): ApiShippingSettings | null {
  const [settings, setSettings] = useState<ApiShippingSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadShippingSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

/**
 * Renders nothing until the rates load, and nothing at all if they can't be
 * reached — an absent promise is better than a wrong one, and this is
 * decorative copy rather than anything the customer acts on.
 */
export function ShippingPromise({ withLeadTime = false }: { withLeadTime?: boolean }) {
  const settings = useShippingSettings();
  if (!settings) return null;

  const leadTime = withLeadTime
    ? `Delivered across Bangladesh in ${settings.standardDeliveryDays} business days. `
    : "";

  if (!settings.freeShippingEnabled) {
    return (
      <>
        {leadTime}
        Delivery from {formatBDT(settings.insideDhakaChargeBDT)} inside Dhaka,{" "}
        {formatBDT(settings.outsideDhakaChargeBDT)} elsewhere.
      </>
    );
  }

  return (
    <>
      {leadTime}
      Free delivery on orders over {formatBDT(settings.freeShippingMinOrderBDT)}.
    </>
  );
}
