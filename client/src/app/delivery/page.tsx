"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, PackageSearch, Truck, UserCheck } from "lucide-react";
import { listAssignedOrders } from "@/lib/api/orders";
import { useAuth } from "@/context/AuthContext";
import { formatBDT } from "@/lib/utils";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { ApiOrder } from "@/types/api";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function customerName(customer: ApiOrder["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

export default function DeliveryDashboardPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listAssignedOrders(1, 100)
      .then(({ data }) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load your assigned orders.");
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
      <div>
        <div className="mb-6 h-28 w-full animate-pulse rounded-xl bg-surface" />
        <TableSkeleton rows={4} />
      </div>
    );
  }

  if (error) return <ErrorState message={error} />;

  const assigned = orders.filter((o) => o.status === "assigned_to_agent");
  const inTransit = orders.filter((o) => o.status === "picked_up" || o.status === "out_for_delivery");
  const delivered = orders.filter((o) => o.status === "delivered");
  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "returned" && o.status !== "cancelled");
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards = [
    { icon: UserCheck, label: "Awaiting Pickup", value: assigned.length },
    { icon: Truck, label: "In Transit", value: inTransit.length },
    { icon: CheckCircle2, label: "Delivered", value: delivered.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-brown-500">{today}</p>
          <h1 className="mt-1 font-serif text-2xl text-green-950 sm:text-[28px]">
            {greeting()}, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-1 text-sm text-brown-600">Here&apos;s what&apos;s on your delivery route today.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.label} className="flex flex-col gap-3 rounded-xl border border-brown-600/10 bg-surface p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
              <card.icon size={16} />
            </span>
            <span>
              <span className="block text-lg font-semibold text-green-950">{card.value}</span>
              <span className="block text-xs text-brown-500">{card.label}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col rounded-xl border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
            <PackageSearch size={18} className="text-green-900" /> Active Orders
          </h2>
        </div>

        {active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 size={26} className="text-green-900/40" />
            <p className="text-sm text-brown-500">No active deliveries right now.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((order) => (
              <li
                key={order._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brown-600/10 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-green-950">#{order.orderNumber}</p>
                  <p className="text-xs text-brown-500">
                    {customerName(order.customer)} &middot; {order.shippingAddress.cityArea},{" "}
                    {order.shippingAddress.district}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={order.status} />
                  <span className="text-sm font-semibold text-green-950">{formatBDT(order.totalBDT)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href="/delivery/orders"
          className="mt-4 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-900 hover:text-green-950"
        >
          View all assigned orders <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
