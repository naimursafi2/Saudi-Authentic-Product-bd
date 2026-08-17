import type { SocialPlatform } from "@/types/api";

/**
 * lucide-react dropped brand/logo glyphs (Facebook, Instagram, Twitter, ...)
 * in recent versions for trademark reasons, so social links render as a
 * lucide-style stroked circle badge with a short monogram instead of a
 * brand logo.
 */
const SOCIAL_INITIALS: Record<SocialPlatform, string> = {
  facebook: "f",
  instagram: "IG",
  twitter: "X",
  youtube: "YT",
  linkedin: "in",
  whatsapp: "WA",
  tiktok: "TT",
};

export function SocialIcon({ platform, size = 16 }: { platform: SocialPlatform; size?: number }) {
  const label = SOCIAL_INITIALS[platform];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <text
        x="12"
        y="12.5"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke="none"
        fill="currentColor"
        fontSize={label.length > 1 ? 7.5 : 10}
        fontWeight="700"
      >
        {label}
      </text>
    </svg>
  );
}
