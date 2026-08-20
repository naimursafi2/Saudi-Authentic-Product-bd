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
  Search,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { SearchOverlay } from "./SearchOverlay";
import type { Category } from "@/types/product";
import type { ApiNavLink, ApiSiteSettings } from "@/types/api";

/** Shared classes for a top-level pill nav item (used by both plain links
 * and the Categories trigger so every item in the center pill matches). */
const NAV_PILL_BASE =
  "relative flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-200";

function navPillClass(active: boolean) {
  return cn(
    NAV_PILL_BASE,
    active
      ? "bg-green-950 text-cream-50 shadow-[0_2px_8px_rgba(1,45,29,0.25)]"
      : "text-brown-600 hover:bg-green-950/[0.06] hover:text-green-950"
  );
}

/** Circular icon-button treatment shared by search / track order / wishlist / cart. */
const ICON_BUTTON_CLASS =
  "relative flex cursor-pointer items-center justify-center rounded-full p-2 text-green-950 transition-colors duration-200 hover:bg-green-950/[0.06] hover:text-gold-600";

const BADGE_CLASS =
  "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-green-950";

interface HeaderProps {
  /** Fetched once, server-side, by the (site) layout — see its comment for why. */
  initialCategories: Category[];
  initialNavLinks: ApiNavLink[];
  initialSettings: ApiSiteSettings | null;
}

export function Header({ initialCategories, initialNavLinks, initialSettings }: HeaderProps) {
  const pathname = usePathname();
  const { totalQuantity, openDrawer } = useCart();
  const { productIds } = useWishlist();
  const { user, status, logout } = useAuth();
  const categories = initialCategories;
  const settings = initialSettings;
  const navLinks = initialNavLinks;
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const siteName = settings?.siteName || "Saudi Authentic Product";
  const isAuthenticated = status === "authenticated" && Boolean(user);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-green-950/8 bg-cream-50/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          {/* Logo — left */}
          <Link
            href="/"
            className="flex shrink-0 cursor-pointer items-center gap-2 font-serif text-xl font-semibold tracking-[-0.02em] text-green-950 sm:text-2xl"
          >
            {settings?.logo?.url && (
              <span className="relative size-8 shrink-0 overflow-hidden rounded-full ring-1 ring-gold-500/30">
                <Image src={settings.logo.url} alt={siteName} fill className="object-cover" />
              </span>
            )}
            {siteName}
          </Link>

          {/* Nav links — center, minimal pill bar */}
          <nav className="hidden items-center gap-0.5 rounded-full border border-green-950/8 bg-white/60 p-1 shadow-[0_1px_2px_rgba(1,45,29,0.04)] lg:flex">
            {navLinks.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link._id}
                  href={link.href}
                  target={link.openInNewTab ? "_blank" : undefined}
                  rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                  className={navPillClass(active)}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Categories dropdown — hover on desktop, focus-visible for keyboard nav. */}
            <div className="group relative flex items-stretch">
              <Link href="/categories" className={navPillClass(pathname.startsWith("/categories"))}>
                Categories
                <ChevronDown size={12} className="transition-transform duration-200 group-hover:rotate-180" />
              </Link>
              <div className="invisible absolute left-1/2 top-full z-10 w-56 -translate-x-1/2 pt-3 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="flex flex-col overflow-hidden rounded-xl border border-gold-500/25 bg-cream-50 py-2 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
                  {categories.length === 0 ? (
                    <span className="px-4 py-2 text-xs text-brown-500">Loading…</span>
                  ) : (
                    categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={category.comingSoon ? "/categories" : `/shop?category=${category.slug}`}
                        className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950"
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
                    className="cursor-pointer px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-950 hover:bg-green-950/5"
                  >
                    View All Categories
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Actions — right: search / track / wishlist / cart / account */}
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button aria-label="Search" onClick={() => setSearchOpen(true)} className={ICON_BUTTON_CLASS}>
              <Search size={18} />
            </button>
            <Link href="/track-order" aria-label="Track Order" className={cn(ICON_BUTTON_CLASS, "hidden sm:flex")}>
              <Truck size={18} />
            </Link>
            <Link href="/wishlist" aria-label="Wishlist" className={cn(ICON_BUTTON_CLASS, "hidden sm:flex")}>
              <Heart size={18} />
              {productIds.length > 0 && <span className={BADGE_CLASS}>{productIds.length}</span>}
            </Link>
            <button aria-label="Open cart" onClick={openDrawer} className={ICON_BUTTON_CLASS}>
              <ShoppingCart size={18} />
              {totalQuantity > 0 && <span className={BADGE_CLASS}>{totalQuantity}</span>}
            </button>

            <div className="mx-1 hidden h-6 w-px bg-green-950/10 sm:block" />

            {/* Account — signed in: name pill linking to the dashboard.
                Signed out: minimal "Log in / Sign up" pair, SaaS-navbar style. */}
            {isAuthenticated ? (
              <Link
                href="/account"
                aria-label="My Account"
                className="hidden cursor-pointer items-center gap-1.5 rounded-full py-2 pl-2 pr-3 text-green-950 transition-colors duration-200 hover:bg-green-950/[0.06] hover:text-gold-600 sm:flex"
              >
                <User size={18} />
                <span className="max-w-[7rem] truncate text-xs font-bold uppercase tracking-[0.06em]">
                  {user!.name.split(" ")[0]}
                </span>
              </Link>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link
                  href="/account"
                  className="cursor-pointer rounded-full px-3.5 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-950 transition-colors duration-200 hover:bg-green-950/[0.06]"
                >
                  Log In
                </Link>
                <Link
                  href="/account?tab=register"
                  className="cursor-pointer rounded-full bg-gold-500 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-green-950 shadow-[0_2px_8px_rgba(196,150,63,0.35)] transition-colors duration-200 hover:bg-gold-600"
                >
                  Sign Up
                </Link>
              </div>
            )}

            <button
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
              className="cursor-pointer rounded-full p-2 text-green-950 hover:bg-green-950/[0.06] lg:hidden"
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
            className="absolute inset-0 cursor-pointer bg-green-950/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-72 flex-col gap-1 overflow-y-auto bg-cream-100 p-6 shadow-2xl animate-slide-in-right">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Menu</span>
              <button aria-label="Close menu" className="cursor-pointer" onClick={() => setMobileOpen(false)}>
                <X size={20} className="text-green-950" />
              </button>
            </div>
            {navLinks.map((link) => (
              <Link
                key={link._id}
                href={link.href}
                target={link.openInNewTab ? "_blank" : undefined}
                rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                onClick={() => setMobileOpen(false)}
                className="cursor-pointer rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/categories"
              onClick={() => setMobileOpen(false)}
              className="cursor-pointer rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
            >
              Categories
            </Link>
            <div className="my-3 h-px bg-green-900/10" />
            <Link
              href="/track-order"
              onClick={() => setMobileOpen(false)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
            >
              <Truck size={16} /> Track Order
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setMobileOpen(false)}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
            >
              <Heart size={16} /> Wishlist
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-3 text-sm font-bold uppercase tracking-[0.1em] text-green-950 hover:bg-green-950/5"
                >
                  <User size={16} /> {user!.name.split(" ")[0]}
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-3 text-left text-sm font-bold uppercase tracking-[0.1em] text-brown-600 hover:bg-green-950/5 hover:text-green-950"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <div className="mt-1 flex flex-col gap-2">
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="cursor-pointer rounded-full border border-green-950/15 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-green-950 hover:bg-green-950/5"
                >
                  Log In
                </Link>
                <Link
                  href="/account?tab=register"
                  onClick={() => setMobileOpen(false)}
                  className="cursor-pointer rounded-full bg-gold-500 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-green-950 hover:bg-gold-600"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
