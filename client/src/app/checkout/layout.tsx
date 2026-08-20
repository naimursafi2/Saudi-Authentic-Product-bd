import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brown-600/15 bg-surface">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 sm:px-10">
          <Link
            href="/cart"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-gold-600 hover:text-gold-700"
          >
            <ArrowLeft size={14} /> Return to Cart
          </Link>
          <Link href="/" className="font-serif text-sm font-semibold text-green-950 sm:text-base">
            Saudi Authentic Product
          </Link>
          <span className="w-[110px]" aria-hidden />
        </div>
      </header>
      <main className="flex-1 bg-cream-100">{children}</main>
    </>
  );
}
