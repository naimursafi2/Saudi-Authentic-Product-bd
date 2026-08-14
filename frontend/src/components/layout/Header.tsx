"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Heart, Menu, Search, ShoppingCart, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { SearchOverlay } from "./SearchOverlay";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/categories", label: "Categories" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
];

export function Header() {
  const pathname = usePathname();
  const { totalQuantity, openDrawer } = useCart();
  const { productIds } = useWishlist();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-brown-600/30 bg-cream-100/95 shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6 lg:px-16">
          <Link
            href="/"
            className="shrink-0 font-serif text-2xl font-semibold tracking-[-0.02em] text-green-950 sm:text-3xl"
          >
            Saudi Authentic Product
          </Link>

          <nav className="hidden items-stretch gap-8 lg:flex">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center border-b-2 pb-[6px] text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                    active
                      ? "border-green-950 text-green-950"
                      : "border-transparent text-brown-600 hover:text-green-950",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4 sm:gap-5">
            <button
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className="text-green-950 transition-opacity hover:opacity-70"
            >
              <Search size={19} />
            </button>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="relative hidden text-green-950 transition-opacity hover:opacity-70 sm:inline-flex"
            >
              <Heart size={19} />
              {productIds.length > 0 && (
                <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-green-950">
                  {productIds.length}
                </span>
              )}
            </Link>
            <Link
              href="/account"
              aria-label="Account"
              className="hidden text-green-950 transition-opacity hover:opacity-70 sm:inline-flex"
            >
              <User size={19} />
            </Link>
            <button
              aria-label="Open cart"
              onClick={openDrawer}
              className="relative text-green-950 transition-opacity hover:opacity-70"
            >
              <ShoppingCart size={19} />
              {totalQuantity > 0 && (
                <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-green-950">
                  {totalQuantity}
                </span>
              )}
            </button>
            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="text-green-950 lg:hidden"
            >
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-green-950/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 bg-cream-100 p-6 shadow-2xl animate-slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X size={20} className="text-green-950" />
              </button>
            </div>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-3 h-px bg-green-900/10" />
            <Link
              href="/wishlist"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
            >
              <Heart size={16} /> Wishlist
            </Link>
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
            >
              <User size={16} /> Account
            </Link>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
