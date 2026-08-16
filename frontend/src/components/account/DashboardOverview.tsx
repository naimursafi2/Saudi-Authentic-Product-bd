"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, PackageCheck, ShoppingCart, Heart, Wallet, MapPin } from "lucide-react";
import { listMyOrders } from "@/lib/api/orders";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { formatBDT, cn } from "@/lib/utils";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import type { ApiOrder, ApiUser, OrderStatus } from "@/types/api";

const STATUS_CLASSES: Record<OrderStatus, string> = {
  pending: "bg-cream-300 text-brown-600",
  processing: "bg-[#fcf8ee] text-[#735c00]",
  shipped: "bg-[#e9f3ee] text-green-900",
  delivered: "bg-green-900 text-white",
  cancelled: "bg-[#fbeceb] text-[#8a4a3f]",
};

export function DashboardOverview({
  user,
  onViewOrders,
  onViewWishlist,
}: {
  user: ApiUser;
  onViewOrders: () => void;
  onViewWishlist: () => void;
}) {
  const { totalQuantity } = useCart();
  const { items: wishlistItems } = useWishlist();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listMyOrders(1, 50)
      .then(({ data }) => {
        if (!cancelled) setOrders(data.orders);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runningOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const amountSpent = orders.reduce((sum, o) => sum + o.totalBDT, 0);
  const recentOrders = orders.slice(0, 3);
  const recentWishlist = wishlistItems.slice(0, 3);

  const stats: {
    label: string;
    value: string;
    icon: typeof ShoppingBag;
    tone: "green" | "gold";
    loading: boolean;
  }[] = [
    { label: "Total order placed", value: String(orders.length), icon: ShoppingBag, tone: "green", loading: isLoading },
    { label: "Running orders", value: String(runningOrders), icon: PackageCheck, tone: "green", loading: isLoading },
    { label: "Items in cart", value: String(totalQuantity), icon: ShoppingCart, tone: "green", loading: false },
    { label: "Product in wishlist", value: String(wishlistItems.length), icon: Heart, tone: "green", loading: false },
    { label: "Amount spent", value: formatBDT(amountSpent), icon: Wallet, tone: "gold", loading: isLoading },
    { label: "Saved addresses", value: String(user.addresses.length), icon: MapPin, tone: "green", loading: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-brown-600/10 bg-white p-5 shadow-[0_1px_2px_rgba(61,43,31,0.04)]"
          >
            <div>
              <p className="text-2xl font-semibold text-green-950">{stat.loading ? "—" : stat.value}</p>
              <p className="mt-1 text-sm text-brown-500">{stat.label}</p>
            </div>
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-full",
                stat.tone === "gold" ? "bg-gold-500/15 text-gold-600" : "bg-green-950/8 text-green-900"
              )}
            >
              <stat.icon size={20} />
            </span>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="overflow-hidden rounded-xl border border-brown-600/10 bg-white shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <div className="flex items-center justify-between bg-green-950 px-5 py-3.5">
          <h2 className="font-serif text-base text-white">Recent Orders</h2>
          <Button
            variant="outline"
            size="xs"
            onClick={onViewOrders}
            className="border-white/30 text-white hover:bg-white/10"
          >
            All Orders
          </Button>
        </div>
        {isLoading ? (
          <div className="flex flex-col gap-2 p-5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-14 w-full animate-pulse rounded bg-cream-200" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="p-8 text-center text-sm text-brown-500">No orders found.</p>
        ) : (
          <ul className="divide-y divide-brown-600/10">
            {recentOrders.map((order) => (
              <li key={order._id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-green-950">#{order.orderNumber}</p>
                  <p className="text-xs text-brown-500">
                    {new Date(order.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {" · "}
                    {order.items.length} item{order.items.length > 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em]",
                      STATUS_CLASSES[order.status]
                    )}
                  >
                    {order.status}
                  </span>
                  <span className="text-sm font-semibold text-green-950">{formatBDT(order.totalBDT)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Wishlist preview */}
      <div className="overflow-hidden rounded-xl border border-brown-600/10 bg-white shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
        <div className="flex items-center justify-between bg-green-950 px-5 py-3.5">
          <h2 className="font-serif text-base text-white">Wishlist Items</h2>
          <Button
            variant="outline"
            size="xs"
            onClick={onViewWishlist}
            className="border-white/30 text-white hover:bg-white/10"
          >
            View More
          </Button>
        </div>
        {recentWishlist.length === 0 ? (
          <p className="p-8 text-center text-sm text-brown-500">No products in wishlist.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {recentWishlist.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
