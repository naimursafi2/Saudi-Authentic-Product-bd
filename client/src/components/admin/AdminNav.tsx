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
  Landmark,
  PiggyBank,
  Receipt,
  Undo2,
  ShieldCheck,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/api";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: Role[];
}

/** Roles that get the full Admin Portal nav — everything except the explicitly
 * admin/super_admin-only pages below. `order_manager` deliberately does NOT
 * get this — every item declares its own `roles`, so a least-privilege Order
 * Manager only ever sees Dashboard, Orders, Refunds, and Audit Logs (their
 * own actions) — the roles relevant to verifying/dispatching orders and
 * reviewing refunds. The real boundary is still backend `authorize()` — this
 * is nav-visibility polish on top of it. */
const FULL_ADMIN_ROLES: Role[] = ["co_admin", "admin", "super_admin"];

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package, roles: FULL_ADMIN_ROLES },
  { href: "/admin/categories", label: "Categories", icon: FolderTree, roles: FULL_ADMIN_ROLES },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  {
    href: "/admin/refunds",
    label: "Refunds",
    icon: Undo2,
    roles: ["co_admin", "order_manager", "admin", "super_admin"],
  },
  { href: "/admin/coupons", label: "Coupons", icon: Tag, roles: ["co_admin", "admin", "super_admin"] },
  { href: "/admin/customers", label: "Customers", icon: Users, roles: FULL_ADMIN_ROLES },
  { href: "/admin/reviews", label: "Reviews", icon: Star, roles: FULL_ADMIN_ROLES },
  { href: "/admin/employees", label: "Employees", icon: UserCog, roles: FULL_ADMIN_ROLES },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck, roles: FULL_ADMIN_ROLES },
  { href: "/admin/leave", label: "Leave Requests", icon: CalendarClock, roles: FULL_ADMIN_ROLES },
  { href: "/admin/tasks", label: "Tasks", icon: ListChecks, roles: FULL_ADMIN_ROLES },
  { href: "/admin/performance", label: "Performance", icon: TrendingUp, roles: FULL_ADMIN_ROLES },
  { href: "/admin/salary", label: "Salary & Payments", icon: Wallet, roles: ["admin", "super_admin"] },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, roles: FULL_ADMIN_ROLES },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, roles: FULL_ADMIN_ROLES },
  { href: "/admin/finance", label: "Finance", icon: Landmark, roles: ["admin", "super_admin"] },
  { href: "/admin/investments", label: "Investments", icon: PiggyBank, roles: ["admin", "super_admin"] },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt, roles: ["co_admin", "admin", "super_admin"] },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, roles: ["super_admin"] },
  {
    href: "/admin/audit-logs",
    label: "Audit Logs",
    icon: ScrollText,
    roles: ["co_admin", "order_manager", "admin", "super_admin"],
  },
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
