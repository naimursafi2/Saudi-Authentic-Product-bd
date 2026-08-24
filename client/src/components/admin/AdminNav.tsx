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
  Store,
  Truck,
  CircleUser,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { Permission } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Shown when the user holds ANY of these. Omitted means "everyone who can
   * reach the portal at all" (Dashboard, Profile). */
  permissions?: Permission[];
}

/**
 * Nav visibility is driven by permissions, not by hardcoded role lists. That
 * means a custom role (DIGITAL_MARKETER, CONTENT_MANAGER, …) automatically
 * gets the right menu without this file being touched — which is the point of
 * the whole permission system.
 *
 * The visible result for the built-in roles is unchanged: an Order Manager
 * still sees only Dashboard, Orders, Refunds, Audit Logs and Profile, because
 * those are exactly the permissions its role carries. As before, this is
 * nav-visibility polish — the real boundary is `requirePermission(...)` on
 * the API route.
 */
const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Products", icon: Package, permissions: ["products.view"] },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: FolderTree,
    permissions: ["categories.create", "categories.edit"],
  },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permissions: ["orders.view"] },
  { href: "/admin/refunds", label: "Refunds", icon: Undo2, permissions: ["refunds.view"] },
  { href: "/admin/coupons", label: "Coupons", icon: Tag, permissions: ["marketing.view"] },
  { href: "/admin/customers", label: "Customers", icon: Users, permissions: ["employees.view"] },
  { href: "/admin/reviews", label: "Reviews", icon: Star, permissions: ["reviews.view"] },
  { href: "/admin/employees", label: "Employees", icon: UserCog, permissions: ["employees.view"] },
  { href: "/admin/roles", label: "Roles & Permissions", icon: KeyRound, permissions: ["roles.view"] },
  { href: "/admin/attendance", label: "Attendance", icon: CalendarCheck, permissions: ["attendance.view"] },
  { href: "/admin/leave", label: "Leave Requests", icon: CalendarClock, permissions: ["leave.view"] },
  { href: "/admin/tasks", label: "Tasks", icon: ListChecks, permissions: ["tasks.view"] },
  { href: "/admin/performance", label: "Performance", icon: TrendingUp, permissions: ["performance.view"] },
  { href: "/admin/salary", label: "Salary & Payments", icon: Wallet, permissions: ["salary.view"] },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: Boxes,
    permissions: ["inventory.logs.view", "inventory.manage"],
  },
  { href: "/admin/purchases", label: "Purchases", icon: Truck, permissions: ["purchases.view"] },
  { href: "/admin/shops", label: "Shops", icon: Store, permissions: ["shops.view"] },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permissions: ["reports.view"] },
  { href: "/admin/finance", label: "Finance", icon: Landmark, permissions: ["finance.view"] },
  { href: "/admin/investments", label: "Investments", icon: PiggyBank, permissions: ["investments.view"] },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt, permissions: ["expenses.view"] },
  { href: "/admin/approvals", label: "Approvals", icon: ShieldCheck, permissions: ["approvals.manage"] },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText, permissions: ["auditLogs.view"] },
  {
    href: "/admin/homepage",
    label: "Homepage",
    icon: LayoutPanelTop,
    permissions: ["content.homepage.manage"],
  },
  {
    href: "/admin/navigation",
    label: "Navigation",
    icon: Compass,
    permissions: ["content.navigation.manage"],
  },
  {
    href: "/admin/footer",
    label: "Footer",
    icon: PanelBottom,
    permissions: ["content.navigation.manage"],
  },
  { href: "/admin/pages", label: "Pages", icon: FileText, permissions: ["content.pages.manage"] },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
    permissions: ["settings.manage", "content.branding.manage"],
  },
  { href: "/admin/profile", label: "Profile", icon: CircleUser },
];

export function AdminNav() {
  const pathname = usePathname();
  const { hasPermission } = useAuth();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.filter((item) => !item.permissions || hasPermission(...item.permissions)).map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-deep-2 text-white" : "text-on-brand/80 hover:bg-white/10"
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
