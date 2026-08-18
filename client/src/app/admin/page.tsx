"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Users,
  Package,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
} from "lucide-react";
import { getAdminDashboard } from "@/lib/api/reports";
import { formatBDT } from "@/lib/utils";
import { PageHeader } from "@/components/admin/PageHeader";
import { TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import type { AdminDashboard } from "@/types/hr";

const STAT_CARDS: {
  key: keyof AdminDashboard | "revenue" | "orders";
  label: string;
  icon: typeof ShoppingBag;
  href: string;
}[] = [
  { key: "revenue", label: "Revenue (30d)", icon: TrendingUp, href: "/admin/reports" },
  { key: "orders", label: "Orders (30d)", icon: ShoppingBag, href: "/admin/orders" },
  { key: "totalCustomers", label: "Customers", icon: Users, href: "/admin/customers" },
  { key: "totalProducts", label: "Active Products", icon: Package, href: "/admin/products" },
  { key: "lowStockCount", label: "Low Stock Alerts", icon: AlertTriangle, href: "/admin/inventory" },
  { key: "pendingLeaves", label: "Pending Leave Requests", icon: CalendarClock, href: "/admin/leave" },
];

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
    <div>
      <PageHeader title="Dashboard" description="Live snapshot of sales, staff and inventory." />

      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : error || !dashboard ? (
        <ErrorState message={error ?? "No data available."} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  className="flex items-center gap-4 rounded-lg border border-brown-600/10 bg-white p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-green-900">
                    <card.icon size={18} />
                  </span>
                  <span>
                    <span className="block text-xl font-semibold text-green-950">{value}</span>
                    <span className="block text-xs text-brown-500">{card.label}</span>
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-brown-600/10 bg-white p-6">
              <h2 className="mb-4 font-serif text-lg text-green-950">Today&apos;s Attendance</h2>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <Stat label="Checked In" value={dashboard.attendanceToday.totalCheckedIn} />
                <Stat label="Present" value={dashboard.attendanceToday.present} />
                <Stat label="Late" value={dashboard.attendanceToday.late} />
                <Stat label="Half Day" value={dashboard.attendanceToday.half_day} />
                <Stat label="Absent" value={dashboard.attendanceToday.absent} />
                <Stat label="On Leave" value={dashboard.attendanceToday.leave} />
              </div>
            </div>

            <div className="rounded-lg border border-brown-600/10 bg-white p-6">
              <h2 className="mb-4 font-serif text-lg text-green-950">Top Products (30d)</h2>
              {dashboard.sales.topProducts.length === 0 ? (
                <p className="text-sm text-brown-500">No sales in this period yet.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {dashboard.sales.topProducts.map((p) => (
                    <li key={p._id} className="flex items-center justify-between text-sm">
                      <span className="text-green-950">{p.name}</span>
                      <span className="text-brown-500">
                        {p.quantitySold} sold &middot; {formatBDT(p.revenueBDT)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-cream-200 p-3 text-center">
      <span className="block text-lg font-semibold text-green-950">{value}</span>
      <span className="block text-[11px] uppercase tracking-wide text-brown-500">{label}</span>
    </div>
  );
}
