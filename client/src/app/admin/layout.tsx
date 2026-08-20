"use client";

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { PERMISSIONS, grantsAdminPortalAccess } from "@/lib/permissions";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  // A custom role is what the person actually does here, so show that rather
  // than the built-in role it sits on top of ("Employee" is not a useful
  // label for someone whose role is Digital Marketer).
  const roleLabel = user.customRole?.name ?? user.role.replace("_", " ");

  return (
    <div className="flex min-h-screen bg-cream-200">
      <aside className="flex w-64 shrink-0 flex-col gap-6 bg-brand-deep p-5">
        <Link href="/admin" className="flex items-center gap-2 px-1 font-serif text-lg text-white">
          <ShieldCheck size={20} className="text-gold-500" />
          Admin Portal
        </Link>
        <AdminNav />
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
          <Link href="/" className="px-1 text-xs text-on-brand/60 underline hover:text-on-brand">
            Back to Storefront
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-x-hidden p-8">{children}</main>
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
