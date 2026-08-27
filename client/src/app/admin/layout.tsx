"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, ShieldCheck, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { PERMISSIONS, grantsAdminPortalAccess } from "@/lib/permissions";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  // A custom role is what the person actually does here, so show that rather
  // than the built-in role it sits on top of ("Employee" is not a useful
  // label for someone whose role is Digital Marketer).
  const roleLabel = user.customRole?.name ?? user.role.replace("_", " ");

  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <Link
        href="/admin"
        onClick={onNavigate}
        className="flex items-center gap-2 px-1 font-serif text-lg text-white"
      >
        <ShieldCheck size={20} className="text-gold-500" />
        Admin Portal
      </Link>
      <AdminNav onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2.5 px-1">
          <UserAvatar name={user.name} src={user.avatar?.url} size={32} />
          <p className="min-w-0 flex-1 text-xs text-on-brand/60">
            <span className="block truncate text-on-brand/85">{user.name}</span>
            <span className="capitalize">{roleLabel}</span>
          </p>
          <ThemeToggle className="text-on-brand/70 hover:bg-white/10 hover:text-on-brand" />
        </div>
        <button
          onClick={logout}
          className="flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm font-medium text-on-brand/80 hover:bg-white/10"
        >
          <LogOut size={16} /> Sign Out
        </button>
        <Link
          href="/"
          onClick={onNavigate}
          className="px-1 text-xs text-on-brand/60 underline hover:text-on-brand"
        >
          Back to Storefront
        </Link>
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-cream-200">
      {/* Desktop sidebar — its own scroll container (sticky + overflow-y-auto)
          so navigating between pages never resets or is tied to the page's
          own scroll position. */}
      <aside className="hidden w-64 shrink-0 border-r border-black/10 bg-brand-deep lg:block">
        <div className="sticky top-0 h-screen overflow-y-auto">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile topbar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-black/10 bg-brand-deep px-4 lg:hidden">
        <button
          aria-label="Open menu"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-on-brand hover:bg-white/10"
        >
          <Menu size={20} />
        </button>
        <Link href="/admin" className="flex items-center gap-2 font-serif text-base text-white">
          <ShieldCheck size={16} className="text-gold-500" />
          Admin Portal
        </Link>
        <UserAvatar name={user.name} src={user.avatar?.url} size={32} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 cursor-pointer bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col bg-brand-deep shadow-2xl animate-slide-in-left">
            <div className="flex items-center justify-end p-3">
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="flex size-9 cursor-pointer items-center justify-center rounded-lg text-on-brand hover:bg-white/10"
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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Entry by built-in role as before, OR by holding any admin-panel
       permission — that second path is how a custom role reaches the portal
       without this list being edited. */
    <RoleGuard
      allowed={["co_admin", "order_manager", "admin", "super_admin"]}
      requireAnyPermission={PERMISSIONS.filter((permission) => grantsAdminPortalAccess([permission]))}
    >
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
