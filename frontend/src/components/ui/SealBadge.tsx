import { cn } from "@/lib/utils";

interface SealBadgeProps {
  size?: number;
  className?: string;
  /** Set false to hide the ring's route micro-copy, e.g. at very small sizes. */
  showRoute?: boolean;
}

/**
 * The storefront's signature mark: a wax-seal-style stamp reading the route
 * this whole business exists to certify (Saudi Arabia -> Bangladesh), built
 * from the brand's own green/gold tokens rather than a generic badge icon.
 * Used on the hero, product "Authentic" badges, and the PDP origin panel.
 */
export function SealBadge({ size = 88, className, showRoute = true }: SealBadgeProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Seal of origin: certified authentic, imported from Saudi Arabia to Bangladesh"
      className={cn("select-none drop-shadow-[0_2px_10px_rgba(1,45,29,0.35)]", className)}
    >
      <defs>
        <path id="seal-arc" d="M 12,52 A 40,40 0 1 1 88,52" fill="none" />
      </defs>
      <circle cx="50" cy="50" r="48" className="fill-green-950" />
      <circle cx="50" cy="50" r="44" fill="none" className="stroke-gold-500" strokeWidth="1" />
      <circle
        cx="50"
        cy="50"
        r="38.5"
        fill="none"
        className="stroke-gold-500/60"
        strokeWidth="0.75"
        strokeDasharray="1.4 2.6"
      />
      {showRoute && (
        <text className="fill-gold-500" fontSize="6" fontWeight="700" letterSpacing="2">
          <textPath href="#seal-arc" startOffset="50%" textAnchor="middle">
            SAUDI ARABIA • BANGLADESH
          </textPath>
        </text>
      )}
      <path
        d="M 38 50 L 46.5 58.5 L 63 41"
        fill="none"
        className="stroke-gold-500"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x="50" y="79" textAnchor="middle" className="fill-cream-50" fontSize="5.5" fontWeight="700" letterSpacing="0.8">
        100% AUTHENTIC
      </text>
    </svg>
  );
}

