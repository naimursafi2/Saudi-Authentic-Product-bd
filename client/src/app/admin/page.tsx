"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  PackageX,
  CalendarClock,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { getAdminDashboard } from "@/lib/api/reports";
import { formatBDT, cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionBadge, actorName, friendlyNote, resourceLabel } from "@/lib/auditLogDisplay";
import type { AdminDashboard } from "@/types/hr";

type StatTone = "success" | "info" | "gold" | "danger";

const TONE_CLASSES: Record<StatTone, string> = {
  success: "bg-success-soft text-green-900",
  info: "bg-info-soft text-info",
  gold: "bg-gold-soft text-gold-700",
  danger: "bg-danger-soft text-danger",
};

const STAT_CARDS: {
  key: keyof AdminDashboard | "revenue" | "orders";
  label: string;
  icon: typeof ShoppingBag;
  href: string;
  tone: StatTone;
}[] = [
  { key: "revenue", label: "Revenue (30d)", icon: TrendingUp, href: "/admin/reports", tone: "success" },
  { key: "orders", label: "Orders (30d)", icon: ShoppingBag, href: "/admin/orders", tone: "info" },
  { key: "totalCustomers", label: "Customers", icon: Users, href: "/admin/customers", tone: "info" },
  { key: "totalProducts", label: "Active Products", icon: Package, href: "/admin/products", tone: "gold" },
  { key: "lowStockCount", label: "Low Stock Alerts", icon: AlertTriangle, href: "/admin/inventory", tone: "gold" },
  { key: "outOfStockCount", label: "Out of Stock", icon: PackageX, href: "/admin/inventory", tone: "danger" },
  {
    key: "pendingLeaves",
    label: "Pending Leave Requests",
    icon: CalendarClock,
    href: "/admin/leave",
    tone: "gold",
  },
];

function customerName(customer: AdminDashboard["recentOrders"][number]["customer"]): string {
  return typeof customer === "string" ? customer : customer.name;
}

/** Section-card header: an icon + heading, with an optional "View all" shortcut to the full page. */
function SectionHeader({
  icon: Icon,
  title,
  viewAllHref,
}: {
  icon: typeof ShoppingBag;
  title: string;
  viewAllHref?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-serif text-lg text-green-950">
        <Icon size={17} className="text-brown-500" />
        {title}
      </h2>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="flex shrink-0 items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-brown-600 transition-colors hover:text-green-950"
        >
          View all
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminDashboard()
      .then(({ data }) => {
        if (!cancelled) setDashboard(data.dashboard);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load dashboard data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Dashboard" description="Live snapshot of sales, staff and inventory." />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !dashboard ? (
        <ErrorState message={error ?? "No data available."} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {STAT_CARDS.map((card) => {
              const value =
                card.key === "revenue"
                  ? formatBDT(dashboard.sales.totalRevenueBDT)
                  : card.key === "orders"
                    ? dashboard.sales.totalOrders
                    : (dashboard[card.key as keyof AdminDashboard] as number);
              return (
                <Link
                  key={card.key}
                  href={card.href}
                  className="flex flex-col gap-3 rounded-lg border border-brown-600/10 bg-surface p-5 transition-all hover:-translate-y-0.5 hover:border-green-900/20 hover:shadow-md"
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      TONE_CLASSES[card.tone]
                    )}
                  >
                    <card.icon size={17} />
                  </span>
                  <span>
                    <span className="block font-serif text-2xl text-green-950">{value}</span>
                    <span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-brown-500">
                      {card.label}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="rounded-lg border border-brown-600/10 bg-surface p-6">
            <SectionHeader icon={TrendingUp} title="Top Products (30d)" viewAllHref="/admin/reports" />
            {dashboard.sales.topProducts.length === 0 ? (
              <p className="text-sm text-brown-500">No sales in this period yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {dashboard.sales.topProducts.map((p) => (
                  <li
                    key={p._id}
                    className="flex items-center justify-between gap-3 border-b border-brown-600/10 py-2.5 text-sm last:border-none"
                  >
                    <span className="min-w-0 truncate text-green-950">{p.name}</span>
                    <span className="shrink-0 text-brown-500">
                      {p.quantitySold} sold &middot; {formatBDT(p.revenueBDT)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-brown-600/10 bg-surface p-6">
              <SectionHeader icon={ShoppingBag} title="Recent Orders" viewAllHref="/admin/orders" />
              {dashboard.recentOrders.length === 0 ? (
                <p className="text-sm text-brown-500">No orders yet.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {dashboard.recentOrders.map((order) => (
                    <li key={order._id} className="border-b border-brown-600/10 last:border-none">
                      <Link
                        href={`/admin/orders?viewOrder=${order._id}`}
                        className="flex items-center justify-between gap-3 py-2.5 text-sm transition-colors hover:text-green-950"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-green-950">#{order.orderNumber}</span>
                          <span className="block truncate text-xs text-brown-500">{customerName(order.customer)}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <StatusBadge status={order.status} />
                          <span className="text-brown-600">{formatBDT(order.totalBDT)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-brown-600/10 bg-surface p-6">
              <SectionHeader icon={Users} title="Recent Activities" viewAllHref="/admin/audit-logs" />
              {dashboard.recentActivities.length === 0 ? (
                <p className="text-sm text-brown-500">No recent activity.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {dashboard.recentActivities.map((log) => {
                    const resource = resourceLabel(log);
                    return (
                      <li
                        key={log._id}
                        className="flex items-start justify-between gap-3 border-b border-brown-600/10 py-2.5 text-sm last:border-none"
                      >
                        <span className="min-w-0">
                          <ActionBadge action={log.action} />
                          <span className="mt-1 block truncate text-xs text-brown-500">
                            {actorName(log.actor)} &middot; {friendlyNote(log)}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-brown-500">{resource.name ?? resource.type}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
