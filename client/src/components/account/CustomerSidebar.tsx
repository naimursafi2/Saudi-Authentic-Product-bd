"use client";

import Image from "next/image";
import { LayoutDashboard, Package, Heart, Bell, MapPin, User as UserIcon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiUser } from "@/types/api";

export type AccountTab = "dashboard" | "orders" | "wishlist" | "alerts" | "addresses" | "profile";

const NAV_ITEMS: { id: AccountTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "orders", label: "My Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "alerts", label: "My Alerts", icon: Bell },
  { id: "addresses", label: "Address", icon: MapPin },
  { id: "profile", label: "Manage Profile", icon: UserIcon },
];

export function CustomerSidebar({
  user,
  tab,
  onTabChange,
  onLogout,
}: {
  user: ApiUser;
  tab: AccountTab;
  onTabChange: (tab: AccountTab) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-64">
      <div className="flex items-center gap-3 rounded-xl bg-brand-deep p-4">
        <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-base font-bold text-gold-500">
          {user.avatar?.url ? (
            <Image
              src={user.avatar.url}
              alt={user.name}
              width={44}
              height={44}
              className="size-full object-cover"
            />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-xs text-on-brand/60">{user.email}</p>
        </div>
      </div>

      <nav className="flex flex-row gap-1 overflow-x-auto rounded-xl bg-brand-deep p-2 lg:flex-col lg:overflow-visible">
        {NAV_ITEMS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "group relative flex shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150",
                active ? "bg-white/10 text-white" : "text-on-brand/65 hover:bg-white/5 hover:text-white"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 hidden h-5 w-[3px] -translate-y-1/2 rounded-full bg-gold-500 transition-opacity duration-150 lg:block",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150",
                  active ? "bg-gold-500/15 text-gold-500" : "text-on-brand/50 group-hover:text-gold-500/80"
                )}
              >
                <item.icon size={16} />
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={onLogout}
        className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-deep px-3 py-3 text-sm font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-brand-deep-2"
      >
        <LogOut size={16} /> Logout
      </button>
    </aside>
  );
}
