"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/context/CompareContext";
import { Button } from "@/components/ui/Button";

const HIDDEN_PREFIXES = ["/admin", "/employee", "/delivery", "/checkout"];

/**
 * Floating "Compare (n)" bar — mounted once in the root layout (same
 * pattern as `CartDrawer`), so it can appear from any storefront page a
 * comparable product card lives on. Hidden entirely once there are no
 * selected products, and on the non-storefront portals/checkout, which
 * never render a compare toggle in the first place.
 */
export function CompareBar() {
  const pathname = usePathname();
  const { items, removeFromCompare, clearCompare } = useCompare();

  if (items.length === 0) return null;
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[80] border-t border-gold-500/30 bg-cream-50 shadow-[0_-4px_20px_rgba(1,45,29,0.12)]">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-green-950">
          <Scale size={15} /> Compare ({items.length})
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {items.map((product) => (
            <span
              key={product.id}
              className="flex items-center gap-1.5 rounded-full border border-brown-600/15 bg-surface py-1 pl-1 pr-2 text-xs text-brown-600"
            >
              <Image
                src={product.images[0]?.url ?? "/images/branding/logo2.png"}
                alt={product.name}
                width={20}
                height={20}
                className="size-5 rounded-full object-cover"
              />
              <span className="max-w-[10rem] truncate">{product.name}</span>
              <button
                type="button"
                aria-label={`Remove ${product.name} from comparison`}
                onClick={() => removeFromCompare(product.id)}
                className="cursor-pointer text-brown-500 hover:text-danger"
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="xs" onClick={clearCompare}>
            Clear
          </Button>
          <Link
            href="/compare"
            className="inline-flex cursor-pointer items-center rounded-full bg-green-950 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.06em] text-white transition-colors hover:bg-green-900"
          >
            Compare Now
          </Link>
        </div>
      </div>
    </div>
  );
}
