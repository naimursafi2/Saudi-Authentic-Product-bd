"use client";

import { useState } from "react";
import { Heart, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { AuthForms } from "@/components/account/AuthForms";
import { AddressBook } from "@/components/account/AddressBook";
import { OrderHistory } from "@/components/account/OrderHistory";
import { ProfileSection } from "@/components/account/ProfileSection";
import { DashboardOverview } from "@/components/account/DashboardOverview";
import { CustomerSidebar, type AccountTab } from "@/components/account/CustomerSidebar";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ADMIN_PORTAL_ROLES, STAFF_ROLES } from "@/lib/roles";

const TAB_COPY: Record<AccountTab, { title: string; description: string }> = {
  dashboard: { title: "Dashboard", description: "Your account at a glance." },
  orders: { title: "My Orders", description: "Track and review your past orders." },
  wishlist: { title: "Wishlist", description: "Products you've saved for later." },
  addresses: { title: "Address", description: "Manage your saved delivery addresses." },
  profile: { title: "Manage Profile", description: "Update your photo, details and password." },
};

export default function AccountPage() {
  const { user, status, logout } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const [tab, setTab] = useState<AccountTab>("dashboard");

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="h-40 w-full animate-pulse rounded-xl bg-cream-300" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <AuthForms />;
  }

  const isStaff = STAFF_ROLES.includes(user.role);

  if (isStaff) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-10 sm:px-10 lg:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
          <div>
            <h1 className="font-serif text-2xl text-green-950">{user.name}</h1>
            <p className="text-sm text-brown-500">{user.email}</p>
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
        <div className="rounded-xl border border-brown-600/10 bg-white p-8 text-center">
          <p className="text-sm text-brown-600">
            Staff accounts manage attendance, tasks and more from their dedicated portal above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:py-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <CustomerSidebar user={user} tab={tab} onTabChange={setTab} onLogout={logout} />

        <div className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="font-serif text-2xl text-green-950">{TAB_COPY[tab].title}</h1>
            <p className="mt-1 text-sm text-brown-500">{TAB_COPY[tab].description}</p>
          </div>

          {tab === "dashboard" && (
            <DashboardOverview
              user={user}
              onViewOrders={() => setTab("orders")}
              onViewWishlist={() => setTab("wishlist")}
            />
          )}
          {tab === "orders" && <OrderHistory />}
          {tab === "wishlist" &&
            (wishlistItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-brown-500/30 bg-white py-16 text-center">
                <Heart size={28} className="text-brown-500/40" />
                <p className="text-sm text-brown-500">Your wishlist is empty.</p>
                <ButtonLink href="/shop" variant="primary" size="sm">
                  Browse Products
                </ButtonLink>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {wishlistItems.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ))}
          {tab === "addresses" && <AddressBook addresses={user.addresses} />}
          {tab === "profile" && <ProfileSection user={user} />}
        </div>
      </div>
    </div>
  );
}
