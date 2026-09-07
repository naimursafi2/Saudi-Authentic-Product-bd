"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Heart,
  HelpCircle,
  Home,
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
    "relative flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.1em] transition-colors duration-200 ease-in-out",
    active
      ? "bg-navbar-secondary-active text-on-gold"
      : "text-on-navbar-secondary hover:bg-navbar-secondary-hover hover:text-navbar-secondary-active",
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
      : "bg-navbar-secondary text-on-navbar-secondary hover:bg-navbar-secondary-hover hover:text-navbar-secondary-active active:bg-navbar-secondary-hover active:text-navbar-secondary-active",
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

const MOBILE_BOTTOM_ITEM_CLASS =
  "mobile-bottom-item flex flex-col items-center rounded-xl text-[10px] font-semibold uppercase tracking-[0.05em] text-on-navbar-secondary transition-colors hover:bg-navbar-secondary-hover";
const MOBILE_BOTTOM_ICON_CLASS = "mobile-bottom-icon";
const MOBILE_BOTTOM_LABEL_CLASS = "mobile-bottom-label";

/** The project uses a custom 768px desktop breakpoint, not Tailwind's `lg` (1024px). */
const DESKTOP_QUERY = "(min-width: 768px)";
/** Ignore the first bit of scroll so the bar never hides while still near the top of the page. */
const SCROLL_HIDE_THRESHOLD_PX = 80;
/** Ignore sub-pixel/momentum jitter so a barely-there scroll doesn't flicker the bar. */
const SCROLL_DELTA_PX = 8;

interface HeaderProps {
  /** Fetched once, server-side, by the (site) layout — see its comment for why. */
  initialCategories: Category[];
  initialNavLinks: ApiNavLink[];
  initialSettings: ApiSiteSettings | null;
}

export function Header({
  initialCategories,
  initialNavLinks,
  initialSettings,
}: HeaderProps) {
  const pathname = usePathname();
  const { totalQuantity, openDrawer } = useCart();
  const { productIds } = useWishlist();
  const { user, status, logout } = useAuth();
  const categories = initialCategories;
  const settings = initialSettings;
  const navLinks = initialNavLinks;
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDrawerMounted, setMobileDrawerMounted] = useState(false);
  const siteName = settings?.siteName || "Saudi Authentic Product";
  const isAuthenticated = status === "authenticated" && Boolean(user);

  function openMobileMenu() {
    setMobileDrawerMounted(true);
    setMobileOpen(true);
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function toggleMobileMenu() {
    if (mobileOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  }

  useEffect(() => {
    if (!mobileOpen || !window.matchMedia("(max-width: 767px)").matches) {
      return;
    }

    const scrollY = window.scrollY;
    const body = document.body;
    const previousBodyStyles = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      body.style.position = previousBodyStyles.position;
      body.style.top = previousBodyStyles.top;
      body.style.width = previousBodyStyles.width;
      body.style.overflow = previousBodyStyles.overflow;
      // `behavior: "instant"` is deliberate, not the default two-arg
      // `scrollTo(0, scrollY)` — this project sets `html { scroll-behavior:
      // smooth }` globally (globals.css, for anchor/back-to-top navigation),
      // and the legacy two-arg form inherits that CSS behavior. That made
      // every menu close (X button, overlay tap, or picking a link from the
      // drawer) visibly animate the homepage scrolling back to its saved
      // position — reported as "the homepage auto-scrolls when I use the
      // menu" on mobile. This restore must be an instant, imperceptible jump
      // back to where the user already was, never a smooth-scrolled one.
      window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
    };
  }, [mobileOpen]);

  // Row 1 (logo/search/actions) hides on scroll-down and reappears on
  // scroll-up, at `lg`+ only — row 2 (the nav-links bar below it) stays put
  // and slides up to occupy row 1's vacated space by the same measured
  // amount, so there's no gap and no layout jump. Below `lg`, row 2 doesn't
  // render at all (see row 2's own comment), so row 1 stays the single,
  // always-visible mobile nav bar exactly as before.
  const [hideTopBar, setHideTopBar] = useState(false);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const topBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const topBarEl = topBarRef.current;
    if (!topBarEl || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setTopBarHeight(entry.contentRect.height);
    });
    observer.observe(topBarEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const isDesktop = window.matchMedia(DESKTOP_QUERY).matches;

      if (isDesktop && y <= SCROLL_HIDE_THRESHOLD_PX) {
        setHideTopBar(false);
        lastY = y;
        return;
      }

      const delta = y - lastY;
      if (delta > SCROLL_DELTA_PX) {
        setHideTopBar(true);
      } else if (isDesktop && delta < -SCROLL_DELTA_PX) {
        setHideTopBar(false);
      } else if (!isDesktop && y === 0) {
        setHideTopBar(false);
      }
      lastY = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

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
    {
      key: "about",
      label: "About Us",
      href: "/about",
      icon: <Info size={16} />,
    },
    {
      key: "wishlist",
      label: "Wishlist",
      href: "/wishlist",
      icon: <Heart size={16} />,
    },
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
              `Hi ${siteName}, I'd like to know more about your products.`,
            ),
            icon: <SocialIcon platform="whatsapp" size={16} />,
            external: true,
          },
        ]
      : []),
  ];

  return (
    <>
      {/* A single sticky unit (not `display: contents` any more): the
          whole header sticks to the viewport as one box, and row 1 / row 2
          are plain, non-positioned children inside it — internal CSS
          `transform`s handle the hide/show below, not a second layer of
          sticky positioning. This still respects the `AnnouncementBar`
          above it exactly like before (a sticky element only starts
          pinning once its own natural document position would scroll past
          `top: 0`, i.e. once the announcement strip has already scrolled
          out of view), so no spacer or height calculation is needed for
          that interaction.

          Row 1 hides via `translateY(-100%)` on scroll-down and reappears
          on scroll-up (`hideTopBar` state above), at `lg`+ only. Row 2 is
          translated by the *measured* height of row 1 (`topBarHeight`, via
          `ResizeObserver` — row 1's real height differs by breakpoint, so a
          hardcoded pixel value would drift) in lock-step, so it slides up
          to exactly fill row 1's vacated space with no gap and no layout
          jump — both use the same `duration-300 ease-in-out` transition so
          they move together. Deliberately transform-only, never an animated
          height/grid-rows collapse: that was tried once already elsewhere in
          this header and caused a stutter fighting live scroll input (see
          the mobile-drawer git history) — nothing here animates any
          element's box size, so there's nothing to fight the scroll
          gesture. Below `lg`, row 2 doesn't render at all (see its own
          comment), so row 1 stays the single, always-visible mobile nav bar
          exactly as before — the hide/show logic forces itself off outside
          the `lg` breakpoint. */}
      <header className="sticky top-0 z-50">
        {/* ---------- Row 1: logo | search | labelled actions ---------- */}
        <div
          ref={topBarRef}
          className="transition-transform duration-300 ease-in-out"
          style={{
            transform: hideTopBar ? "translateY(-100%)" : "translateY(0)",
          }}
        >
          <div className="bg-navbar shadow-[0_1px_3px_rgba(1,45,29,0.08)] lg:shadow-none">
            <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:px-8">
              {/* Hamburger — LEFT, so the drawer slides in from the edge it sits on. */}
              <button
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={toggleMobileMenu}
                className="mobile-only -ml-1 cursor-pointer rounded-full p-2 text-green-950 transition-colors hover:bg-green-950/[0.08]"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
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
              <HeaderSearchBar className="desktop-only mx-auto w-full max-w-md" />

              <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
                {/* Compact search for screens too narrow for the inline bar. */}
                <button
                  aria-label="Search"
                  onClick={() => setSearchOpen(true)}
                  className={cn(ACTION_CLASS, "mobile-only")}
                >
                  <Search size={19} />
                  <span className={cn(ACTION_LABEL_CLASS, "hidden")}>
                    Search
                  </span>
                </button>

                <Link
                  href="/track-order"
                  className={cn(ACTION_CLASS, "desktop-only")}
                >
                  <Truck size={19} />
                  <span className={ACTION_LABEL_CLASS}>Track Order</span>
                </Link>

                <Link
                  href="/wishlist"
                  className={cn(ACTION_CLASS, "desktop-only")}
                >
                  <span className="relative">
                    <Heart size={19} />
                    {productIds.length > 0 && (
                      <span className={BADGE_CLASS}>{productIds.length}</span>
                    )}
                  </span>
                  <span className={ACTION_LABEL_CLASS}>Wishlist</span>
                </Link>

                {isAuthenticated && user!.role === "customer" && (
                  <NotificationBell
                    actionClassName={ACTION_CLASS}
                    labelClassName={ACTION_LABEL_CLASS}
                    badgeClassName={BADGE_CLASS}
                  />
                )}

                <button
                  aria-label="Open cart"
                  onClick={openDrawer}
                  className={ACTION_CLASS}
                >
                  <span className="relative">
                    <ShoppingCart size={19} />
                    {totalQuantity > 0 && (
                      <span className={BADGE_CLASS}>{totalQuantity}</span>
                    )}
                  </span>
                  <span
                    className={cn(ACTION_LABEL_CLASS, "desktop-only-inline")}
                  >
                    Cart
                  </span>
                </button>

                {/* Account — avatar (uploaded picture, else monogram) once signed
                in, a labelled Sign In action otherwise. */}
                {isAuthenticated ? (
                  <Link
                    href="/account"
                    title={user!.name}
                    className={cn(ACTION_CLASS, "desktop-only")}
                  >
                    <UserAvatar
                      name={user!.name}
                      src={user!.avatar?.url}
                      size={20}
                    />
                    <span
                      className={cn(
                        ACTION_LABEL_CLASS,
                        "max-w-[6rem] truncate",
                      )}
                    >
                      {user!.name.split(" ")[0]}
                    </span>
                  </Link>
                ) : (
                  <Link
                    href="/account"
                    className={cn(ACTION_CLASS, "desktop-only")}
                  >
                    <User size={19} />
                    <span className={ACTION_LABEL_CLASS}>Sign In</span>
                  </Link>
                )}

                <ThemeToggle className="ml-0.5" />
              </div>
            </div>
          </div>

          {/* Hidden at every breakpoint (`hidden`, not removed — the
            component and its functionality stay intact, just never
            rendered) so mobile/tablet has exactly one search entry point:
            the compact search icon in row 1 above, which opens
            `SearchOverlay`. This used to be a second, full-width inline
            search row shown only below `lg` — duplicating the navbar's own
            search affordance on small screens — which is why it's hidden
            outright now rather than kept `lg:hidden`. Restore it (e.g. back
            to `lg:hidden`) only if a future request explicitly asks for a
            second mobile search bar again. */}
          <div className="hidden">
            <HeaderSearchBar className="w-full" />
          </div>
        </div>

        {/* ---------- Row 2: main nav / categories ----------
            Only rendered at `lg`+ (see row 1's comment on why mobile has no
            second bar). Translated by row 1's measured height in lock-step
            with row 1's own hide/show, so it slides up to take row 1's
            place with no gap. */}
        <nav
          className="desktop-only bg-navbar-secondary transition-transform duration-300 ease-in-out"
          style={{
            transform: hideTopBar
              ? `translateY(-${topBarHeight}px)`
              : "translateY(0)",
          }}
        >
          <div className="mx-auto flex max-w-[1240px] items-center gap-1 px-4 py-2 sm:px-6 lg:px-8">
            {navLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
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
              <Link
                href="/categories"
                className={navLinkClass(pathname.startsWith("/categories"))}
              >
                Categories
                <ChevronDown
                  size={12}
                  className="transition-transform duration-200 group-hover:rotate-180"
                />
              </Link>
              <div className="invisible absolute left-0 top-full z-10 w-56 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <div className="flex flex-col overflow-hidden rounded-xl border border-gold-500/25 bg-cream-50 py-2 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
                  {categories.length === 0 ? (
                    <span className="px-4 py-2 text-xs text-brown-500">
                      Loading…
                    </span>
                  ) : (
                    categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={
                          category.comingSoon
                            ? "/categories"
                            : `/shop?category=${category.slug}`
                        }
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
                      <Link
                        key={item.key}
                        href={item.href}
                        className={itemClassName}
                      >
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

      {/*
        Mobile drawer and the fixed bottom nav are separate render layers.

        The drawer state must never unmount the nav itself: the drawer is a
        transient overlay, while the bottom nav is a permanent mobile control
        rail that stays visible across the entire viewport. Keeping the nav in
        its own sibling branch avoids the previous regression where the menu
        state could hide the nav by virtue of being coupled to the same render
        tree.
      */}
      {mobileDrawerMounted && (
        <div
          className={cn(
            "mobile-only fixed inset-0 z-[90] transition-opacity duration-300 ease-out",
            mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === "opacity" &&
              !mobileOpen
            ) {
              setMobileDrawerMounted(false);
            }
          }}
        >
          <button
            aria-label="Close menu"
            className={cn(
              "absolute inset-0 cursor-pointer bg-brand-deep/40 transition-opacity duration-300 ease-out",
              mobileOpen ? "opacity-100" : "opacity-0",
            )}
            onClick={closeMobileMenu}
          />
          <div
            className={cn(
              "absolute left-0 top-0 z-[100] flex h-full w-72 flex-col gap-1 overflow-y-auto bg-cream-100 p-6 shadow-2xl transition-transform duration-300 ease-out",
              mobileOpen ? "animate-slide-in-left" : "-translate-x-full",
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-serif text-xl text-green-950">Menu</span>
              <button
                aria-label="Close menu"
                className="cursor-pointer"
                onClick={closeMobileMenu}
              >
                <X size={20} className="text-green-950" />
              </button>
            </div>
            {navLinks.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link._id}
                  href={link.href}
                  target={link.openInNewTab ? "_blank" : undefined}
                  rel={link.openInNewTab ? "noopener noreferrer" : undefined}
                  onClick={closeMobileMenu}
                  className={mobileNavLinkClass(active)}
                >
                  {link.label}
                </Link>
              );
            })}
            <Link
              href="/categories"
              onClick={closeMobileMenu}
              className={mobileNavLinkClass(pathname.startsWith("/categories"))}
            >
              Categories
            </Link>
            <div className="my-3 h-px bg-green-900/10" />
            <Link
              href="/track-order"
              onClick={closeMobileMenu}
              className={MOBILE_ITEM_CLASS}
            >
              <Truck size={16} /> Track Order
            </Link>
            <Link
              href="/wishlist"
              onClick={closeMobileMenu}
              className={MOBILE_ITEM_CLASS}
            >
              <Heart size={16} /> Wishlist
            </Link>
            <Link
              href="/about"
              onClick={closeMobileMenu}
              className={MOBILE_ITEM_CLASS}
            >
              <Info size={16} /> About Us
            </Link>
            <Link
              href="/faq"
              onClick={closeMobileMenu}
              className={MOBILE_ITEM_CLASS}
            >
              <HelpCircle size={16} /> FAQs
            </Link>
            {contactPhone && (
              <>
                <a
                  href={toTelHref(contactPhone)}
                  onClick={closeMobileMenu}
                  className={MOBILE_ITEM_CLASS}
                >
                  <Phone size={16} /> Call Us
                </a>
                <a
                  href={toWhatsAppHref(
                    contactPhone,
                    `Hi ${siteName}, I'd like to know more about your products.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
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
                  onClick={closeMobileMenu}
                  className={MOBILE_ITEM_CLASS}
                >
                  <UserAvatar
                    name={user!.name}
                    src={user!.avatar?.url}
                    size={22}
                  />
                  <span className="truncate">{user!.name.split(" ")[0]}</span>
                </Link>
                <button
                  onClick={() => {
                    closeMobileMenu();
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
                onClick={closeMobileMenu}
                className="mt-1 cursor-pointer rounded-full bg-gold-500 px-4 py-2.5 text-center text-xs font-bold uppercase tracking-[0.08em] text-on-gold hover:bg-gold-600"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}

      <nav className="mobile-only fixed inset-x-0 bottom-0 z-[120] border-t border-on-navbar-secondary/20 bg-navbar-secondary px-2 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-2 shadow-[0_-8px_24px_rgba(1,45,29,0.08)] backdrop-blur-sm">
        <div className="mobile-bottom-grid mx-auto grid max-w-md grid-cols-5 items-center">
          <Link href="/" className={MOBILE_BOTTOM_ITEM_CLASS} aria-label="Home">
            <Home
              size={18}
              className={cn(
                MOBILE_BOTTOM_ICON_CLASS,
                pathname === "/" ? "text-gold-600" : "",
              )}
            />
            <span className={MOBILE_BOTTOM_LABEL_CLASS}>Home</span>
          </Link>

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={toggleMobileMenu}
            className={MOBILE_BOTTOM_ITEM_CLASS}
          >
            {mobileOpen ? (
              <X size={18} className={MOBILE_BOTTOM_ICON_CLASS} />
            ) : (
              <Menu size={18} className={MOBILE_BOTTOM_ICON_CLASS} />
            )}
            <span className={MOBILE_BOTTOM_LABEL_CLASS}>Menu</span>
          </button>

          <button
            type="button"
            aria-label="Open cart"
            onClick={openDrawer}
            className={cn("relative", MOBILE_BOTTOM_ITEM_CLASS)}
          >
            <ShoppingCart size={18} className={MOBILE_BOTTOM_ICON_CLASS} />
            {totalQuantity > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[8px] font-bold text-on-gold">
                {totalQuantity}
              </span>
            )}
            <span className={MOBILE_BOTTOM_LABEL_CLASS}>Cart</span>
          </button>

          <button
            type="button"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
            className={MOBILE_BOTTOM_ITEM_CLASS}
          >
            <Search size={18} className={MOBILE_BOTTOM_ICON_CLASS} />
            <span className={MOBILE_BOTTOM_LABEL_CLASS}>Search</span>
          </button>

          {isAuthenticated && user!.role === "customer" ? (
            <Link
              href="/account"
              className={MOBILE_BOTTOM_ITEM_CLASS}
              aria-label="Profile"
            >
              <UserAvatar
                name={user!.name}
                src={user!.avatar?.url}
                size={20}
                className="mobile-bottom-profile-avatar"
              />
              <span className={MOBILE_BOTTOM_LABEL_CLASS}>Profile</span>
            </Link>
          ) : (
            <Link
              href="/account"
              className={MOBILE_BOTTOM_ITEM_CLASS}
              aria-label="Account"
            >
              <User size={18} className={MOBILE_BOTTOM_ICON_CLASS} />
              <span className={MOBILE_BOTTOM_LABEL_CLASS}>Account</span>
            </Link>
          )}
        </div>
      </nav>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
