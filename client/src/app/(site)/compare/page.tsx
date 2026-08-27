"use client";

import Link from "next/link";
import Image from "next/image";
import { Scale, X } from "lucide-react";
import { useCompare } from "@/context/CompareContext";
import { formatBDT, cn } from "@/lib/utils";
import { StarRating } from "@/components/ui/StarRating";
import { ButtonLink, Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";

const ROWS: { label: string; render: (p: ReturnType<typeof useCompare>["items"][number]) => React.ReactNode }[] = [
  {
    label: "Price",
    render: (p) => formatBDT(Math.min(...p.variants.map((v) => v.priceBDT))),
  },
  { label: "Rating", render: (p) => (p.ratingCount > 0 ? <StarRating rating={p.ratingAverage} size={13} /> : "No reviews yet") },
  { label: "Origin", render: (p) => p.origin },
  { label: "Badge", render: (p) => p.badge ?? "—" },
  { label: "Weights Available", render: (p) => p.variants.map((v) => v.label).join(", ") },
  {
    label: "In Stock",
    render: (p) => (p.variants.some((v) => v.stock > 0) ? "Yes" : "Out of stock"),
  },
  { label: "Storage", render: (p) => p.storageInstructions ?? "—" },
];

export default function ComparePage() {
  const { items, removeFromCompare, clearCompare } = useCompare();

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-24 text-center">
        <Scale size={40} className="text-brown-500/50" />
        <h1 className="font-serif text-3xl text-green-950">No products to compare</h1>
        <p className="max-w-sm text-sm text-brown-500">
          Use &quot;Add to Compare&quot; on the shop page to line products up side by side.
        </p>
        <ButtonLink href="/shop" variant="primary" size="md" className="mt-2">
          Browse Products
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-10 sm:px-10 lg:px-16 lg:py-14">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="Compare Products" align="left" dividerWidth={64} />
        <Button variant="outline" size="sm" onClick={clearCompare}>
          Clear All
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-brown-600/10">
              <th className="w-40 px-4 py-3" />
              {items.map((product) => (
                <th key={product.id} className="px-4 py-4 align-top">
                  <div className="flex flex-col items-start gap-2">
                    <button
                      type="button"
                      aria-label={`Remove ${product.name} from comparison`}
                      onClick={() => removeFromCompare(product.id)}
                      className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-brown-500 hover:text-danger"
                    >
                      <X size={13} /> Remove
                    </button>
                    <Link href={`/product/${product.slug}`} className="flex flex-col items-start gap-2">
                      <Image
                        src={product.images[0]?.url ?? "/images/branding/logo2.png"}
                        alt={product.name}
                        width={96}
                        height={96}
                        className="size-24 rounded object-cover"
                      />
                      <span className="font-semibold text-green-950 hover:underline">{product.name}</span>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} className={cn("border-b border-brown-600/10 last:border-none", i % 2 === 1 && "bg-cream-100/50")}>
                <td className="px-4 py-3 text-xs font-bold uppercase tracking-[0.06em] text-brown-500">{row.label}</td>
                {items.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-brown-600">
                    {row.render(product)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
