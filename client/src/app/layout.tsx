import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-cream-100 font-sans text-ink-900 antialiased">
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
