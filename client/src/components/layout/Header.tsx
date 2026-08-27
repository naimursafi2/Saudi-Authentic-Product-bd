"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  Heart,
  HelpCircle,
  Info,
  LogOut,
  Menu,
  Phone,
  Search,
  ShoppingCart,
  Truck,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toTelHref, toWhatsAppHref } from "@/lib/phone";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useAuth } from "@/context/AuthContext";
import { SearchOverlay } from "./SearchOverlay";
import { HeaderSearchBar } from "./HeaderSearchBar";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { SocialIcon } from "@/components/ui/SocialIcon";
import type { Category } from "@/types/product";
import type { ApiNavLink, ApiSiteSettings } from "@/types/api";

/**
 * Two-row header, in the shape common to Bangladeshi storefronts
 * (ghorerbazar.com was the reference):
 *
 *   Row 1 — logo | search bar | labelled action icons (Track Order, account,
 *           Wishlist, Cart). Icons carry their label rather than standing
 *           alone, so nothing depends on recognising a glyph.
 *   Row 2 — the main nav/category links as a full-width horizontal bar.
 *
 * Only the structure is borrowed; the palette, typography and components are
 * this project's own. Below `lg` the whole thing collapses to: hamburger +
 * logo + cart on row one, the search bar on row two, and the nav links move
 * into the left-hand drawer.
 */

/**
 * Day-one default logo, shown until an Admin/Co-Admin/Super Admin uploads
 * one via /admin/settings (see `SiteSettingsForm`/`BrandingLogoForm`) —
 * never preferred over `SiteSettings.logo.url` once one exists.
 */
const FALLBACK_LOGO_SRC = "/images/branding/logo2.png";

/** A labelled action in the top row: icon above/next to its own text. */
const ACTION_CLASS =
  "group relative flex cursor-pointer flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-green-950 transition-colors duration-200 hover:bg-green-950/[0.06] hover:text-gold-600";

const ACTION_LABEL_CLASS =
  "text-[10px] font-bold uppercase tracking-[0.06em] leading-none whitespace-nowrap";

const BADGE_CLASS =
  "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-gold-500 text-[9px] font-bold text-on-gold";

/**
 * A link in the second-row nav bar — the premium emerald/gold pill row
 * (Home/Shop/Offers/About/Contact/Categories). `navbar-secondary*` and
 * `on-gold` are the constant (non-theme-switching) tokens in globals.css;
 * see their comment there for why this bar doesn't follow the light/dark
 * toggle. `duration-200 ease-in-out` is the "smooth hover/active" transition
 * asked for — 200ms sits inside the requested 200–250ms window.
 */
function navLinkClass(active: boolean) {
  return cn(
    "relative flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] transition-colors duration-200 ease-in-out",
    active
      ? "bg-navbar-secondary-active text-on-gold"
      : "text-on-navbar-secondary hover:bg-navbar-secondary-hover hover:text-navbar-secondary-active"
  );
}

/**
 * The same nav links' treatment inside the mobile drawer, which is where
 * this bar actually lives below `lg` (the pill row itself is `lg:block`
 * only) — each link becomes its own small emerald/gold pill so the drawer
 * stays visually tied to the desktop bar instead of falling back to plain
 * text on the drawer's cream background. Every other drawer row (Track
 * Order, Wishlist, account, Sign Out) is untouched — `MOBILE_ITEM_CLASS`.
 */
function mobileNavLinkClass(active: boolean) {
  return cn(
    "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-semibold tracking-[0.04em] transition-colors duration-200 ease-in-out",
    active
      ? "bg-navbar-secondary-active text-on-gold"
      : "bg-navbar-secondary text-on-navbar-secondary hover:bg-navbar-secondary-hover hover:text-navbar-secondary-active active:bg-navbar-secondary-hover active:text-navbar-secondary-active"
  );
}

/**
 * One shared treatment for every row in the mobile drawer, so the menu stays
 * visually flat and minimal — no per-item variants. The hover/active state
 * changes both background AND text color so the feedback is unmistakable on
 * a phone, where there is no lingering cursor: `active:` covers the tap
 * highlight, since `hover:` is unreliable on touch.
 */
const MOBILE_ITEM_CLASS =
  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-3 text-sm font-semibold tracking-[0.04em] text-green-950 transition-colors duration-150 hover:bg-green-950/10 hover:text-gold-600 active:bg-green-950/15 active:text-gold-600";

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

  // "More" menu — About Us / Wishlist / FAQs / Call Us / WhatsApp, in the
  // header's row 2 on desktop and the mobile drawer below `lg`. Call
  // Us/WhatsApp read the phone number from `SiteSettings.contactPhone`
  // (edited at /admin/settings, same field the Contact page already shows)
  // rather than a hardcoded number, and simply don't render until an
  // admin sets one — same graceful-degrade pattern as the announcement
  // strip and Google Sign-In elsewhere in this app.
  const contactPhone = settings?.contactPhone?.trim();
  const moreMenuItems: {
    key: string;
    label: string;
    href: string;
    icon: React.ReactNode;
    external?: boolean;
  }[] = [
    { key: "about", label: "About Us", href: "/about", icon: <Info size={16} /> },
    { key: "wishlist", label: "Wishlist", href: "/wishlist", icon: <Heart size={16} /> },
    { key: "faq", label: "FAQs", href: "/faq", icon: <HelpCircle size={16} /> },
    ...(contactPhone
      ? [
          {
            key: "call",
            label: "Call Us",
            href: toTelHref(contactPhone),
            icon: <Phone size={16} />,
          },
          {
            key: "whatsapp",
            label: "WhatsApp",
            href: toWhatsAppHref(
              contactPhone,
              `Hi ${siteName}, I'd like to know more about your products.`
            ),
            icon: <SocialIcon platform="whatsapp" size={16} />,
            external: true,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* `display: contents` (not a normal block): a `position: sticky`
          descendant's containing block is its nearest block-container
          ancestor REGARDLESS of that ancestor's own `position` (this only
          differs for absolute/fixed, which need a positioned ancestor) — so
          a plain, ordinary `<header>` wrapping both rows would silently cap
          how far row 1 (sticky below `lg`) and row 2 (sticky at `lg`+) can
          stick to header's own short ~124px box, un-sticking the instant
          the page scrolls past it. `contents` removes header's own box
          entirely (so its children's containing block becomes `<body>`,
          which spans the whole page) while keeping `<header>` in the
          accessibility tree as a landmark — verified empirically: nav
          stayed pinned through a full scroll only after this change, not
          before. Confirmed independently that this isn't the earlier
          "stuttering" bug either — that was caused by an animated
          grid-template-rows collapse fighting live scroll input on a
          sticky element's OWN box; nothing here animates any element's
          size, so there's nothing to fight the scroll gesture. */}
      <header className="contents">
        {/* ---------- Row 1: logo | search | labelled actions ----------
            Sticky only below `lg` (it's the only persistent nav bar on
            mobile, so it stays put); at `lg`+ it's plain normal-flow
            content, so it scrolls away naturally as the page scrolls and
            row 2 takes over as the sticky nav — no JS, no animated
            height/collapse, just native `position: sticky` plus ordinary
            document flow, which is what keeps this perfectly smooth. */}
        <div className="sticky top-0 z-50 bg-navbar shadow-[0_1px_3px_rgba(1,45,29,0.08)] lg:static lg:shadow-none">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:px-8">
          {/* Hamburger — LEFT, so the drawer slides in from the edge it sits on. */}
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="-ml-1 cursor-pointer rounded-full p-2 text-green-950 transition-colors hover:bg-green-950/[0.08] lg:hidden"
          >
            <Menu size={22} />
          </button>

          <Link
            href="/"
            className="flex shrink-0 cursor-pointer items-center self-stretch"
            aria-label={siteName}
          >
            {/* Logo is 100% database-driven, same convention as the hero
                banner (see "Homepage content management" in CLAUDE.md):
                `settings.logo.url` is whatever Admin/Co-Admin/Super Admin
                last uploaded via /admin/settings. `FALLBACK_LOGO_SRC` is only
                the day-one default before anyone has uploaded one — it is
                never preferred over a configured logo, and is a transparent
                PNG so it sits cleanly on the navbar in both themes. Intrinsic
                width/height match the fallback file's real aspect ratio
                (2080x756) so the browser reserves the right box before it
                loads, with no distortion or layout shift; `object-contain` +
                `w-auto` + a fixed height is what actually renders it at
                every breakpoint, and the parent's `self-stretch` +
                `items-center` keeps it vertically centered against the
                taller action icons beside it. */}
            <Image
              src={settings?.logo?.url || FALLBACK_LOGO_SRC}
              alt={siteName}
              width={2080}
              height={756}
              priority
              className="h-11 w-auto object-contain sm:h-12 lg:h-14"
            />
          </Link>

          {/* Search — the centre of the top row on desktop. */}
          <HeaderSearchBar className="mx-auto hidden w-full max-w-md lg:flex" />

          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {/* Compact search for screens too narrow for the inline bar. */}
            <button
              aria-label="Search"
              onClick={() => setSearchOpen(true)}
              className={cn(ACTION_CLASS, "lg:hidden")}
            >
              <Search size={19} />
              <span className={cn(ACTION_LABEL_CLASS, "hidden sm:block")}>Search</span>
            </button>

            <Link href="/track-order" className={cn(ACTION_CLASS, "hidden sm:flex")}>
              <Truck size={19} />
              <span className={ACTION_LABEL_CLASS}>Track Order</span>
            </Link>

            <Link href="/wishlist" className={cn(ACTION_CLASS, "hidden sm:flex")}>
              <span className="relative">
                <Heart size={19} />
                {productIds.length > 0 && <span className={BADGE_CLASS}>{productIds.length}</span>}
              </span>
              <span className={ACTION_LABEL_CLASS}>Wishlist</span>
            </Link>

            {isAuthenticated && user!.role === "customer" && (
              <NotificationBell actionClassName={ACTION_CLASS} labelClassName={ACTION_LABEL_CLASS} badgeClassName={BADGE_CLASS} />
            )}

            <button aria-label="Open cart" onClick={openDrawer} className={ACTION_CLASS}>
              <span className="relative">
                <ShoppingCart size={19} />
                {totalQuantity > 0 && <span className={BADGE_CLASS}>{totalQuantity}</span>}
              </span>
              <span className={cn(ACTION_LABEL_CLASS, "hidden sm:block")}>Cart</span>
            </button>

            {/* Account — avatar (uploaded picture, else monogram) once signed
                in, a labelled Sign In action otherwise. */}
            {isAuthenticated ? (
              <Link
                href="/account"
                title={user!.name}
                className={cn(ACTION_CLASS, "hidden sm:flex")}
              >
                <UserAvatar name={user!.name} src={user!.avatar?.url} size={20} />
                <span className={cn(ACTION_LABEL_CLASS, "max-w-[6rem] truncate")}>
                  {user!.name.split(" ")[0]}
                </span>
              </Link>
            ) : (
              <Link href="/account" className={cn(ACTION_CLASS, "hidden sm:flex")}>
                <User size={19} />
                <span className={ACTION_LABEL_CLASS}>Sign In</span>
              </Link>
            )}

            <ThemeToggle className="ml-0.5" />
          </div>
        </div>
        </div>

        {/* Search bar drops to its own row on tablet/mobile, where row 1 is
            full. Plain normal-flow content, same as row 1 above at `lg`+ —
            it scrolls away under the sticky row 1 as the page scrolls,
            with no JS needed. */}
        <div className="mx-auto max-w-[1240px] px-4 pb-3 sm:px-6 lg:hidden">
          <HeaderSearchBar className="w-full" />
        </div>

        {/* ---------- Row 2: main nav / categories ----------
            Sticky only at `lg`+, taking over from row 1 once it's scrolled
            out of the normal document flow above. */}
        <nav className="sticky top-0 z-50 hidden bg-navbar-secondary lg:block">
          <div className="mx-auto flex max-w-[1240px] items-center gap-1 px-4 py-1.5 sm:px-6 lg:px-8">
            {navLinks.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link._id}
                  href={link.href}
                  target={link.openInNewTab ? "_blank" : undefined}
                  rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                  className={navLinkClass(active)}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Categories dropdown — hover on desktop, focus-within for keyboard nav. */}
            <div className="group relative flex items-stretch">
              <Link href="/categories" className={navLinkClass(pathname.startsWith("/categories"))}>
                Categories
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-hover:rotate-180"
                />
              </Link>
              <div className="invisible absolute left-0 top-full z-10 w-56 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
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
                          /* gold-700, not gold-600: at 10px this sits on a
                             near-white dropdown, where gold-600 only reached
                             2.8:1 — below AA, and too small to qualify for
                             the large-text exemption. */
                          <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-gold-700">
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

            {/* More dropdown — About Us / Wishlist / FAQs / Call Us /
                WhatsApp, same hover + focus-within flyout pattern as
                Categories above, just right-aligned since it's the last
                item in the row. */}
            <div className="group relative ml-auto flex items-stretch">
              <button type="button" className={navLinkClass(false)}>
                More
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-hover:rotate-180"
                />
              </button>
              <div className="invisible absolute right-0 top-full z-10 w-52 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="flex flex-col overflow-hidden rounded-xl border border-gold-500/25 bg-cream-50 py-2 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
                  {moreMenuItems.map((item) => {
                    const itemClassName =
                      "flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm text-brown-600 hover:bg-green-950/5 hover:text-green-950";
                    // tel:/wa.me links aren't app routes — a plain <a> avoids
                    // next/link trying to client-navigate a non-http scheme
                    // (same reasoning as the footer's mailto link).
                    return item.href.startsWith("/") ? (
                      <Link key={item.key} href={item.href} className={itemClassName}>
                        {item.icon}
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        key={item.key}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        className={itemClassName}
                      >
                        {item.icon}
                        {item.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* No separate "Sign Up" here: "Sign In" in the top row is the
                single auth entry point, and the sign-in page offers
                registration via its own tabs and a "Create one" link. */}
          </div>
        </nav>
      </header>

      {/* ---------- Mobile drawer — opens from the LEFT ---------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 cursor-pointer bg-brand-deep/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-72 flex-col gap-1 overflow-y-auto bg-cream-100 p-6 shadow-2xl animate-slide-in-left">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Menu</span>
              <button
                aria-label="Close menu"
                className="cursor-pointer"
                onClick={() => setMobileOpen(false)}
              >
                <X size={20} className="text-green-950" />
              </button>
            </div>
            {navLinks.map((link) => {
              const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link._id}
                  href={link.href}
                  target={link.openInNewTab ? "_blank" : undefined}
                  rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={mobileNavLinkClass(active)}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/categories"
              onClick={() => setMobileOpen(false)}
              className={mobileNavLinkClass(pathname.startsWith("/categories"))}
            >
              Categories
            </Link>
            <div className="my-3 h-px bg-green-900/10" />
            <Link
              href="/track-order"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_ITEM_CLASS}
            >
              <Truck size={16} /> Track Order
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setMobileOpen(false)}
              className={MOBILE_ITEM_CLASS}
            >
              <Heart size={16} /> Wishlist
            </Link>
            <Link href="/about" onClick={() => setMobileOpen(false)} className={MOBILE_ITEM_CLASS}>
              <Info size={16} /> About Us
            </Link>
            <Link href="/faq" onClick={() => setMobileOpen(false)} className={MOBILE_ITEM_CLASS}>
              <HelpCircle size={16} /> FAQs
            </Link>
            {contactPhone && (
              <>
                <a
                  href={toTelHref(contactPhone)}
                  onClick={() => setMobileOpen(false)}
                  className={MOBILE_ITEM_CLASS}
                >
                  <Phone size={16} /> Call Us
                </a>
                <a
                  href={toWhatsAppHref(
                    contactPhone,
                    `Hi ${siteName}, I'd like to know more about your products.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMobileOpen(false)}
                  className={MOBILE_ITEM_CLASS}
                >
                  <SocialIcon platform="whatsapp" size={16} /> WhatsApp
                </a>
              </>
            )}
            {isAuthenticated ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className={MOBILE_ITEM_CLASS}
                >
                  <UserAvatar name={user!.name} src={user!.avatar?.url} size={22} />
                  <span className="truncate">{user!.name.split(" ")[0]}</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logout();
                  }}
                  className={cn(MOBILE_ITEM_CLASS, "w-full text-left")}
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              /* Single auth entry point, matching the desktop header. */
              <Link
                href="/account"
                onClick={() => setMobileOpen(false)}
                className="mt-1 cursor-pointer rounded-full bg-gold-500 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-on-gold hover:bg-gold-600"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
