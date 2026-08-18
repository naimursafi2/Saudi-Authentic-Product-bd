import { Award, BadgeCheck, Clock, Globe, HandCoins, Leaf, Package, ShieldCheck, Star, Truck } from "lucide-react";
import type { StaticPageBlockIcon } from "@/types/api";

/** Maps a `StaticPage` block's stored icon name to its lucide component — keep in sync with the backend's `STATIC_PAGE_BLOCK_ICONS` enum. */
export const STATIC_PAGE_BLOCK_ICON_MAP: Record<StaticPageBlockIcon, typeof BadgeCheck> = {
  BadgeCheck,
  ShieldCheck,
  Globe,
  HandCoins,
  Truck,
  Clock,
  Package,
  Award,
  Star,
  Leaf,
};

export const STATIC_PAGE_BLOCK_ICONS: StaticPageBlockIcon[] = Object.keys(
  STATIC_PAGE_BLOCK_ICON_MAP
) as StaticPageBlockIcon[];
