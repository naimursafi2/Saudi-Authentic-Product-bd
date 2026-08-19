"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { AuthForms } from "@/components/account/AuthForms";
import { EmailVerificationBanner } from "@/components/account/EmailVerificationBanner";
import { AddressBook } from "@/components/account/AddressBook";
import { OrderHistory } from "@/components/account/OrderHistory";
import { ProfileSection } from "@/components/account/ProfileSection";
import { DashboardOverview } from "@/components/account/DashboardOverview";
import { CustomerSidebar, type AccountTab } from "@/components/account/CustomerSidebar";
import { ProductCard } from "@/components/ui/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { STAFF_ROLES } from "@/lib/roles";
import type { Role } from "@/types/api";

/** Where each staff role lands immediately after sign-in — no intermediate choice screen. */
function staffPortalPath(role: Role): string {
  if (role === "employee") return "/employee";
  if (role === "delivery_agent") return "/delivery";
  return "/admin";
}

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
  const router = useRouter();
  const isStaff = Boolean(user && STAFF_ROLES.includes(user.role));

  useEffect(() => {
    if (status === "authenticated" && user && isStaff) {
      router.replace(staffPortalPath(user.role));
    }
  }, [status, user, isStaff, router]);

  if (status === "loading" || (status === "authenticated" && isStaff)) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        <div className="h-40 w-full animate-pulse rounded-xl bg-cream-300" />
      </div>
    );
  }

  if (status === "unauthenticated" || !user) {
    return <AuthForms />;
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

          {!user.isEmailVerified && <EmailVerificationBanner email={user.email} />}

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
