"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ListChecks, CalendarClock, TrendingUp, Wallet, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/employee", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employee/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/employee/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/employee/leave", label: "Leave", icon: CalendarClock },
  { href: "/employee/performance", label: "Performance", icon: TrendingUp },
  { href: "/employee/salary", label: "Salary", icon: Wallet },
];

export function EmployeeNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/employee" ? pathname === "/employee" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-green-900 text-white" : "text-cream-100/80 hover:bg-white/10"
            )}
          >
            <item.icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
