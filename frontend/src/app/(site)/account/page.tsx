"use client";

import { useState } from "react";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthForms } from "@/components/account/AuthForms";
import { AddressBook } from "@/components/account/AddressBook";
import { OrderHistory } from "@/components/account/OrderHistory";
import { Button, ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ADMIN_PORTAL_ROLES, STAFF_ROLES } from "@/lib/roles";

const TABS = ["orders", "addresses", "profile"] as const;
type Tab = (typeof TABS)[number];

export default function AccountPage() {
  const { user, status, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("orders");

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1000px] px-6 py-24">
        <div className="h-40 w-full animate-pulse rounded-lg bg-cream-300" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <AuthForms />;
  }

  return (
    <div className="mx-auto max-w-[1000px] px-6 py-10 sm:px-10 lg:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-green-900 text-white">
            <User size={20} />
          </span>
          <div>
            <h1 className="font-serif text-2xl text-green-950">{user.name}</h1>
            <p className="text-sm text-brown-500">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {ADMIN_PORTAL_ROLES.includes(user.role) && (
            <ButtonLink href="/admin" variant="outline" size="sm">
              Admin Portal
            </ButtonLink>
          )}
          {user.role === "employee" && (
            <ButtonLink href="/employee" variant="outline" size="sm">
              Employee Portal
            </ButtonLink>
          )}
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut size={14} /> Sign Out
          </Button>
        </div>
      </div>

      {!STAFF_ROLES.includes(user.role) && (
        <div className="mb-8 flex gap-1 rounded border border-green-900/15 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded py-2 text-xs font-bold uppercase tracking-[0.08em] capitalize transition-colors",
                tab === t ? "bg-green-900 text-white" : "text-brown-600 hover:bg-green-950/5"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {STAFF_ROLES.includes(user.role) ? (
        <div className="rounded-lg border border-brown-600/10 bg-white p-8 text-center">
          <p className="text-sm text-brown-600">
            Staff accounts manage attendance, tasks and more from their dedicated portal above.
          </p>
        </div>
      ) : (
        <>
          {tab === "orders" && <OrderHistory />}
          {tab === "addresses" && <AddressBook addresses={user.addresses} />}
          {tab === "profile" && (
            <div className="flex flex-col gap-3 rounded-lg border border-brown-600/10 bg-white p-6">
              <Row label="Full Name" value={user.name} />
              <Row label="Email" value={user.email} />
              <Row label="Phone" value={user.phone ?? "—"} />
              <Row
                label="Member Since"
                value={new Date(user.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-brown-600/10 py-2 last:border-none">
      <span className="text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{label}</span>
      <span className="text-sm text-green-950">{value}</span>
    </div>
  );
}
