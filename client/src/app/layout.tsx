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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-cream-100 font-sans text-ink-900 antialiased">
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <ImpersonationBanner />
              {children}
              <CartDrawer />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
