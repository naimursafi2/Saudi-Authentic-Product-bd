import type { IconType } from "react-icons";
import {
  FaFacebookF,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
  FaLinkedinIn,
  FaWhatsapp,
  FaTiktok,
} from "react-icons/fa6";
import type { SocialPlatform } from "@/types/api";

/**
 * Real brand glyphs via `react-icons` (`fa6` set) — a deliberate,
 * project-wide addition (installed for this) that supersedes the earlier
 * stroked-circle-monogram fallback this component used while lucide-react
 * had no brand icons of its own. Kept as one shared component (used by the
 * header's "More" menu and the footer's "Follow Us" row) so every social
 * link across the site renders identically.
 */
const SOCIAL_ICON_COMPONENTS: Record<SocialPlatform, IconType> = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  twitter: FaXTwitter,
  youtube: FaYoutube,
  linkedin: FaLinkedinIn,
  whatsapp: FaWhatsapp,
  tiktok: FaTiktok,
};

export function SocialIcon({ platform, size = 16 }: { platform: SocialPlatform; size?: number }) {
  const Icon = SOCIAL_ICON_COMPONENTS[platform];
  return <Icon size={size} aria-hidden="true" />;
}
