"use client";

import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import { listMyOrders } from "@/lib/api/orders";
import { formatBDT } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ApiOrder, OrderStatus } from "@/types/api";

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-cream-300 text-brown-600",
  processing: "bg-[#fcf8ee] text-[#735c00]",
  shipped: "bg-[#e9f3ee] text-green-900",
  delivered: "bg-green-900 text-white",
  cancelled: "bg-[#fbeceb] text-[#8a4a3f]",
};

export function OrderHistory() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyOrders()
      .then(({ data }) => {
        if (!cancelled) setOrders(data.orders);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-cream-300" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-brown-500/30 py-16 text-center">
        <Package size={32} className="text-brown-500/50" />
        <p className="text-sm text-brown-500">You haven&apos;t placed any orders yet.</p>
        <ButtonLink href="/shop" variant="primary" size="sm">
          Start Shopping
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((order) => (
        <div key={order._id} className="flex flex-col gap-3 rounded-lg border border-brown-600/10 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-green-950">#{order.orderNumber}</p>
              <p className="text-xs text-brown-500">
                {new Date(order.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
                STATUS_CLASSES[order.status]
              )}
            >
              {order.status}
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-sm text-brown-600">
            {order.items.map((item) => (
              <li key={`${item.product}-${item.variantId}`}>
                {item.quantity}× {item.productName} ({item.variantLabel})
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-end border-t border-brown-600/10 pt-3">
            <span className="text-sm font-semibold text-green-950">{formatBDT(order.totalBDT)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
