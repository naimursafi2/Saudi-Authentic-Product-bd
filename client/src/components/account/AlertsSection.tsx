"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Bell, BellRing } from "lucide-react";
import { listMyProductAlerts, unsubscribeFromProductAlert } from "@/lib/api/productAlerts";
import { formatBDT } from "@/lib/utils";
import type { ApiProduct, ApiProductAlert } from "@/types/api";

function isPopulatedProduct(product: ApiProductAlert["product"]): product is ApiProduct {
  return typeof product !== "string";
}

/** The customer's own "Notify Me" subscriptions — see `ProductAlertButtons.tsx` on the product page. */
export function AlertsSection() {
  const [alerts, setAlerts] = useState<ApiProductAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    listMyProductAlerts()
      .then(({ data }) => setAlerts(data.alerts))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleRemove(alertId: string) {
    setRemovingId(alertId);
    try {
      await unsubscribeFromProductAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a._id !== alertId));
    } finally {
      setRemovingId(null);
    }
  }

  if (isLoading) {
    return <div className="h-32 w-full animate-pulse rounded-xl bg-cream-300" />;
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-brown-500/30 bg-surface py-16 text-center">
        <Bell size={28} className="text-brown-500/40" />
        <p className="text-sm text-brown-500">
          No active alerts. Look for &quot;Notify me&quot; on a product page to get one.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {alerts.map((alert) => {
        const product = isPopulatedProduct(alert.product) ? alert.product : null;
        return (
          <div
            key={alert._id}
            className="flex items-center gap-4 rounded-lg border border-brown-600/10 bg-surface p-3"
          >
            <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded bg-cream-200">
              {product?.images[0]?.url ? (
                <Image src={product.images[0].url} alt={product.name} width={56} height={56} className="size-full object-cover" />
              ) : (
                <Bell size={18} className="text-brown-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              {product ? (
                <Link href={`/product/${product.slug}`} className="truncate text-sm font-semibold text-green-950 hover:underline">
                  {product.name}
                </Link>
              ) : (
                <span className="text-sm font-semibold text-green-950">Product no longer available</span>
              )}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brown-500">
                {alert.type === "back_in_stock" ? <BellRing size={12} /> : <Bell size={12} />}
                {alert.variantLabel} &middot;{" "}
                {alert.type === "back_in_stock"
                  ? "Notify when back in stock"
                  : `Notify if price drops below ${formatBDT(alert.referencePriceBDT ?? 0)}`}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleRemove(alert._id)}
              disabled={removingId === alert._id}
              className="inline-flex shrink-0 items-center rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger transition-colors duration-150 hover:bg-danger-soft-hover"
            >
              {removingId === alert._id ? "Removing..." : "Remove"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
