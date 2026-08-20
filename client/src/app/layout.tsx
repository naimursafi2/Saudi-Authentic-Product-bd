import type { Metadata } from "next";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/500.css";
import "@fontsource/eb-garamond/600.css";
import "@fontsource/eb-garamond/700.css";
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
import { ThemeProvider } from "@/context/ThemeContext";
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
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('sap:theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-cream-100 font-sans text-ink-900 antialiased">
        <ThemeProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <ImpersonationBanner />
                {children}
                <CartDrawer />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
