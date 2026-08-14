"use client";

import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RoleGuard } from "@/components/admin/RoleGuard";
import { AdminNav } from "@/components/admin/AdminNav";

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-cream-200">
      <aside className="flex w-64 shrink-0 flex-col gap-6 bg-green-950 p-5">
        <Link href="/admin" className="flex items-center gap-2 px-1 font-serif text-lg text-white">
          <ShieldCheck size={20} className="text-gold-500" />
          Admin Portal
        </Link>
        <AdminNav role={user.role} />
        <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
          <p className="px-1 text-xs text-cream-100/60">
            {user.name} &middot; <span className="capitalize">{user.role.replace("_", " ")}</span>
          </p>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-cream-100/80 hover:bg-white/10"
          >
            <LogOut size={16} /> Sign Out
          </button>
          <Link href="/" className="px-1 text-xs text-cream-100/60 underline hover:text-cream-100">
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
    <RoleGuard allowed={["co_admin", "admin", "super_admin"]}>
      <AdminShell>{children}</AdminShell>
    </RoleGuard>
  );
}
