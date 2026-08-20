import { BadgeCheck, Globe2 } from "lucide-react";
import { STATIC_PAGE_BLOCK_ICON_MAP } from "@/lib/staticPageBlockIcons";
import type { ApiTrustStripBlock, ApiHomepageSection } from "@/types/api";

const FALLBACK_BLOCKS: ApiTrustStripBlock[] = [
  { icon: "BadgeCheck", label: "100% Authentic", isVisible: true },
  { icon: "Globe", label: "Imported from Saudi", isVisible: true },
  { icon: "Truck", label: "Fast Delivery", isVisible: true },
  { icon: "ShieldCheck", label: "Quality Assured", isVisible: true },
];

// "Globe" reads slightly differently across icon sets than the storefront's
// original hand-picked Globe2 — keep the exact original glyph for that one.
const ICON_OVERRIDES = { Globe: Globe2 } as const;

export function TrustStrip({ section }: { section?: ApiHomepageSection }) {
  const blocks = (section?.blocks?.length ? section.blocks : FALLBACK_BLOCKS).filter(
    (block) => block.isVisible
  );
  if (blocks.length === 0) return null;

  return (
    <ul className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-x-6 gap-y-5 border-b border-brown-600/10 px-6 py-8 sm:grid-cols-4 sm:gap-4 sm:px-10 lg:px-16">
      {blocks.map((block, i) => {
        const Icon =
          ICON_OVERRIDES[block.icon as keyof typeof ICON_OVERRIDES] ??
          STATIC_PAGE_BLOCK_ICON_MAP[block.icon] ??
          BadgeCheck;
        return (
          <li key={`${block.icon}-${i}`} className="flex flex-col items-center gap-2 text-center sm:flex-row sm:text-left">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-deep text-gold-500">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-green-950 sm:text-[13px]">
              {block.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
