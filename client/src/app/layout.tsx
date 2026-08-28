import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "@fontsource/plus-jakarta-sans/400-italic.css";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { RecentlyViewedProvider } from "@/context/RecentlyViewedContext";
import { CompareProvider } from "@/context/CompareContext";
import { CompareBar } from "@/components/product/CompareBar";
import { ThemeProvider } from "@/context/ThemeContext";
import { ConfirmDialogProvider } from "@/context/ConfirmDialogContext";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ImpersonationBanner } from "@/components/account/ImpersonationBanner";

export const metadata: Metadata = {
  title: {
    default: "Saudi Authentic Product | Premium Saudi Dates in Bangladesh",
    template: "%s | Saudi Authentic Product",
  },
  description:
    "Authentic Saudi & Madinah dates, gift boxes and heritage products, delivered across Bangladesh.",
};

/**
 * Applies the saved theme BEFORE first paint. Without this, a returning
 * dark-mode visitor gets a white flash while React hydrates, because the
 * server has no way to know their preference. Kept as a tiny inline string
 * (not an imported module) so it runs synchronously in <head> order, and
 * wrapped in try/catch so storage being unavailable can never break the
 * page. `THEME_STORAGE_KEY` in context/ThemeContext.tsx must match the key
 * used here.
 *
 * Deliberately does NOT fall back to `prefers-color-scheme` — the default
 * for a fresh visitor with no saved preference is always Light, regardless
 * of their OS setting. The `<html>` tag below already carries
 * `data-theme="light"` as its static default, so this script only needs to
 * act when a saved preference actually says otherwise.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('sap:theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t;}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-cream-100 font-sans text-ink-900 antialiased">
        {/* `beforeInteractive` is the App-Router-supported way to run a
            script before hydration/paint — Next.js injects it into the
            document `<head>` itself during SSR regardless of where this
            component sits in the tree, unlike a raw `<script>` tag (which
            React refuses to execute when rendered client-side and which
            Next.js's App Router flags at the source, since a Server
            Component's markup — including a literal `<script>` — is only
            ever meant to describe DOM for hydration, not run code). */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <RecentlyViewedProvider>
                  <CompareProvider>
                    <ConfirmDialogProvider>
                      <ImpersonationBanner />
                      {children}
                      <CartDrawer />
                      <CompareBar />
                    </ConfirmDialogProvider>
                  </CompareProvider>
                </RecentlyViewedProvider>
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
