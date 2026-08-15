"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Heart,
  LogOut,
  Menu,
  Package,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { useCategories } from "@/lib/hooks/useCategories";
import { useSiteSettings } from "@/lib/hooks/useSiteSettings";
import { SearchOverlay } from "./SearchOverlay";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/offers", label: "Offers" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const { totalQuantity, openDrawer } = useCart();
  const { productIds } = useWishlist();
  const { user, status, logout } = useAuth();
  const { categories } = useCategories();
  const { settings } = useSiteSettings();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const siteName = settings?.siteName || "Saudi Authentic Product";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-brown-600/30 bg-cream-100/95 shadow-[0_1px_1px_rgba(0,0,0,0.05)] backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-6 lg:px-16">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 font-serif text-2xl font-semibold tracking-[-0.02em] text-green-950 sm:text-3xl"
          >
            {settings?.logo?.url && (
              <span className="relative size-8 shrink-0 overflow-hidden rounded-full sm:size-9">
                <Image src={settings.logo.url} alt={siteName} fill className="object-cover" />
              </span>
            )}
            {siteName}
          </Link>

          <nav className="hidden items-stretch gap-8 lg:flex">
            <Link
              href="/"
              className={cn(
                "flex items-center border-b-2 pb-[6px] text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                pathname === "/"
                  ? "border-green-950 text-green-950"
                  : "border-transparent text-brown-600 hover:text-green-950"
              )}
            >
              Home
            </Link>
            <Link
              href="/shop"
              className={cn(
                "flex items-center border-b-2 pb-[6px] text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                pathname.startsWith("/shop")
                  ? "border-green-950 text-green-950"
                  : "border-transparent text-brown-600 hover:text-green-950"
              )}
            >
              Shop
            </Link>

            {/* Categories dropdown — hover on desktop, focus-visible for keyboard nav. */}
            <div className="group relative flex items-stretch">
              <Link
                href="/categories"
                className={cn(
                  "flex items-center gap-1 border-b-2 pb-[6px] text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                  pathname.startsWith("/categories")
                    ? "border-green-950 text-green-950"
                    : "border-transparent text-brown-600 hover:text-green-950"
                )}
              >
                Categories
                <ChevronDown size={12} className="transition-transform group-hover:rotate-180" />
              </Link>
              <div className="invisible absolute left-1/2 top-full z-10 w-56 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="flex flex-col overflow-hidden rounded-lg border border-gold-500/25 bg-cream-50 py-2 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
                  {categories.length === 0 ? (
                    <span className="px-4 py-2 text-xs text-brown-500">Loading…</span>
                  ) : (
                    categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={category.comingSoon ? "/categories" : `/shop?category=${category.slug}`}
                        className="flex items-center justify-between px-4 py-2 text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950"
                      >
                        {category.name}
                        {category.comingSoon && (
                          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gold-600">
                            Soon
                          </span>
                        )}
                      </Link>
                    ))
                  )}
                  <div className="my-1 h-px bg-green-900/10" />
                  <Link
                    href="/categories"
                    className="px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-950 hover:bg-green-950/5"
                  >
                    View All Categories
                  </Link>
                </div>
              </div>
            </div>

            {NAV_LINKS.slice(2).map((link) => {
              const active = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center border-b-2 pb-[6px] text-xs font-bold uppercase tracking-[0.1em] transition-colors",
                    active
                      ? "border-green-950 text-green-950"
                      : "border-transparent text-brown-600 hover:text-green-950"
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

            {/* Account dropdown — auth-aware, same hover/focus pattern as Categories. */}
            <div className="group relative hidden sm:flex sm:items-stretch">
              <Link
                href="/account"
                aria-label="Account"
                className="flex items-center gap-1 text-green-950 transition-opacity hover:opacity-70"
              >
                <User size={19} />
              </Link>
              <div className="invisible absolute right-0 top-full z-10 w-52 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="flex flex-col overflow-hidden rounded-lg border border-gold-500/25 bg-cream-50 py-2 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
                  {status === "authenticated" && user ? (
                    <>
                      <div className="px-4 py-2">
                        <p className="truncate text-sm font-semibold text-green-950">{user.name}</p>
                        <p className="truncate text-xs text-brown-500">{user.email}</p>
                      </div>
                      <div className="my-1 h-px bg-green-900/10" />
                      <Link
                        href="/account"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950"
                      >
                        <Package size={14} /> My Orders
                      </Link>
                      <button
                        onClick={logout}
                        className="flex items-center gap-2 px-4 py-2 text-left text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950"
                      >
                        <LogOut size={14} /> Sign Out
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/account"
                        className="px-4 py-2 text-sm font-semibold text-green-950 hover:bg-green-950/5"
                      >
                        Sign In
                      </Link>
                      <Link
                        href="/account"
                        className="px-4 py-2 text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950"
                      >
                        Create Account
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

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
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 overflow-y-auto bg-cream-100 p-6 shadow-2xl animate-slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Menu</span>
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              >
                <X size={20} className="text-green-950" />
              </button>
            </div>
            {[{ href: "/", label: "Home" }, { href: "/shop", label: "Shop" }, { href: "/categories", label: "Categories" }, ...NAV_LINKS.slice(2)].map((link) => (
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
              <User size={16} /> {status === "authenticated" ? "My Account" : "Sign In"}
            </Link>
            {status === "authenticated" && (
              <button
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 rounded px-2 py-3 text-left text-sm font-bold uppercase tracking-[0.1em] text-brown-600 hover:bg-green-950/5 hover:text-green-950"
              >
                <LogOut size={16} /> Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
