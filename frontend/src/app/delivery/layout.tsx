"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, Truck, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { DeliveryNav } from "@/components/delivery/DeliveryNav";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link href="/delivery" onClick={onNavigate} className="flex items-center gap-2 px-1 font-serif text-lg text-white">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-gold-500">
          <Truck size={17} />
        </span>
        Delivery Portal
      </Link>
      <DeliveryNav onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 text-sm font-bold text-gold-500">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
            <span className="block truncate text-xs text-cream-100/55">
              {user.staffMeta?.employeeId ?? "Delivery Agent"}
            </span>
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-cream-100/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <LogOut size={16} /> Sign Out
        </button>
        <Link
          href="/"
          onClick={onNavigate}
          className="px-3 text-xs text-cream-100/50 underline-offset-2 hover:text-cream-100 hover:underline"
        >
          Back to Storefront
        </Link>
      </div>
    </div>
  );
}

function DeliveryShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-cream-200">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-black/10 bg-green-950 lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-black/10 bg-green-950 px-4 lg:hidden">
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-lg text-cream-100 hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
        <Link href="/delivery" className="flex items-center gap-2 font-serif text-base text-white">
          <Truck size={16} className="text-gold-500" />
          Delivery Portal
        </Link>
        <span className="flex size-8 items-center justify-center rounded-full bg-gold-500/20 text-xs font-bold text-gold-500">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-green-950 shadow-2xl animate-slide-in-left">
            <div className="flex items-center justify-end p-3">
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-cream-100 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-x-hidden p-4 pt-20 sm:p-6 sm:pt-24 lg:p-8 lg:pt-8">{children}</main>
    </div>
  );
}

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard allowed={["delivery_agent"]}>
      <DeliveryShell>{children}</DeliveryShell>
    </RoleGuard>
  );
}
