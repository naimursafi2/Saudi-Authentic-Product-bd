"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PackageSearch, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/delivery", label: "Dashboard", icon: LayoutDashboard },
  { href: "/delivery/orders", label: "Assigned Orders", icon: PackageSearch },
  { href: "/delivery/profile", label: "Profile", icon: UserCircle },
];

export function DeliveryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/delivery" ? pathname === "/delivery" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              active ? "bg-white/10 text-white" : "text-cream-100/65 hover:bg-white/5 hover:text-white"
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold-500 transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0"
              )}
            />
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                active ? "bg-gold-500/15 text-gold-500" : "text-cream-100/50 group-hover:text-gold-500/80"
              )}
            >
              <item.icon size={16} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
