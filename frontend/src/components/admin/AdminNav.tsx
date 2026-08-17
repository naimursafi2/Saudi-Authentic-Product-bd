"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingBag,
  Users,
  Star,
  UserCog,
  CalendarCheck,
  CalendarClock,
  ListChecks,
  TrendingUp,
  Wallet,
  Boxes,
  BarChart3,
  LayoutPanelTop,
  Compass,
  PanelBottom,
  Settings,
  Tag,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/coupons", label: "Coupons", icon: Tag, roles: ["admin", "super_admin"] },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/employees", label: "Employees", icon: UserCog },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/admin/leave", label: "Leave Requests", icon: CalendarClock },
  { href: "/admin/tasks", label: "Tasks", icon: ListChecks },
  { href: "/admin/performance", label: "Performance", icon: TrendingUp },
  { href: "/admin/salary", label: "Salary & Payments", icon: Wallet, roles: ["admin", "super_admin"] },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/homepage", label: "Homepage", icon: LayoutPanelTop, roles: ["admin", "super_admin"] },
  { href: "/admin/navigation", label: "Navigation", icon: Compass, roles: ["admin", "super_admin"] },
  { href: "/admin/footer", label: "Footer", icon: PanelBottom, roles: ["admin", "super_admin"] },
  { href: "/admin/pages", label: "Pages", icon: FileText, roles: ["admin", "super_admin"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["admin", "super_admin"] },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
