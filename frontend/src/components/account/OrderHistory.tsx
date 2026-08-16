"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Search } from "lucide-react";
import { listMyOrders } from "@/lib/api/orders";
import { formatBDT, cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyOrders(1, 50)
      .then(({ data }) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your orders.");
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
          <div key={i} className="h-32 w-full animate-pulse rounded-xl bg-white" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-[#8a4a3f]/30 bg-white py-16 text-center text-sm text-[#8a4a3f]">
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-brown-500/30 bg-white py-16 text-center">
        <Package size={32} className="text-brown-500/50" />
        <p className="text-sm text-brown-500">You haven&apos;t placed any orders yet.</p>
        <ButtonLink href="/shop" variant="primary" size="sm">
          Start Shopping
        </ButtonLink>
      </div>
    );
  }

  const pendingCount = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <SummaryTile label="Total Orders" value={orders.length} />
        <SummaryTile label="In Progress" value={pendingCount} />
        <SummaryTile label="Delivered" value={deliveredCount} />
      </div>

      <div className="flex flex-col gap-4">
        {orders.map((order) => (
          <div
            key={order._id}
            className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-white p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)] transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
                  <Package size={17} />
                </span>
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

            <ul className="flex flex-col gap-1 border-y border-brown-600/10 py-3 text-sm text-brown-600">
              {order.items.map((item) => (
                <li key={`${item.product}-${item.variantId}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">
                    {item.quantity}× {item.productName} ({item.variantLabel})
                  </span>
                  <span className="shrink-0 text-brown-500">{formatBDT(item.lineTotalBDT)}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`}
                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
              >
                <Search size={12} /> Track Order
              </Link>
              <span className="text-base font-semibold text-green-950">{formatBDT(order.totalBDT)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-brown-600/10 bg-white p-4 text-center">
      <span className="block text-xl font-semibold text-green-950">{value}</span>
      <span className="block text-[11px] font-bold uppercase tracking-wide text-brown-500">{label}</span>
    </div>
  );
}
