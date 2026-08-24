import { Schema, model, type Document, type Model, type Types } from "mongoose";
import { STATIC_PAGE_BLOCK_ICONS, type StaticPageBlockIcon } from "./StaticPage.model";

/**
 * The six fixed types map 1:1 to the storefront's existing homepage
 * components — one document each, lazily seeded by
 * `homepageSection.service.ts#ensureDefaultSections`, editable (title/
 * subtitle/description/visibility/order) but not deletable. `promoBanner`,
 * `productShowcase` and `banner` are the three freely creatable/deletable
 * types: `promoBanner` for ad-hoc promotional content, `productShowcase`
 * for a configurable product grid (by category, best sellers, new
 * arrivals, or on-sale) — this is how Admin adds things like "Premium
 * Dates", "More Date Varieties", or (once real stock exists) a
 * Watches/Chocolates showcase without any code change — and `banner` for
 * the homepage's dual/carousel promotional banner row (`BannerCarousel`,
 * see `(site)/page.tsx`): every visible `banner` section is collected into
 * one carousel (2-up on desktop, 1-up with arrows below `md`), not
 * rendered individually like `promoBanner`, so it supports an unlimited
 * number of banners with no code change either.
 */
export const HOMEPAGE_SECTION_TYPES = [
  "hero",
  "trustStrip",
  "featuredCategories",
  "bestSellers",
  "productStory",
  "customerReviews",
  "promoBanner",
  "productShowcase",
  "banner",
] as const;
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];

export const PRODUCT_SHOWCASE_MODES = ["category", "bestSellers", "newArrivals", "onSale"] as const;
export type ProductShowcaseMode = (typeof PRODUCT_SHOWCASE_MODES)[number];

/** `trustStrip` only — one benefit/trust icon+label item. Reuses `StaticPage`'s icon allow-list. */
export interface ITrustStripBlock {
  icon: StaticPageBlockIcon;
  label: string;
  isVisible: boolean;
}

const trustStripBlockSchema = new Schema<ITrustStripBlock>(
  {
    icon: { type: String, required: true, enum: STATIC_PAGE_BLOCK_ICONS },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false }
);

export interface IHomepageSection extends Document {
  _id: Types.ObjectId;
  type: HomepageSectionType;
  title?: string;
  subtitle?: string;
  description?: string;
  image?: { url: string; publicId: string };
  ctaLabel?: string;
  ctaHref?: string;
  isVisible: boolean;
  sortOrder: number;
  /** `productShowcase` only — which category to pull from when `productMode` is "category". */
  categorySlug?: string;
  /** `productShowcase` only — how the product list is resolved. */
  productMode?: ProductShowcaseMode;
  /** `productShowcase` only — max products to display. */
  limit?: number;
  /** `trustStrip` only — replaced wholesale on update. */
  blocks?: ITrustStripBlock[];
  createdAt: Date;
  updatedAt: Date;
}

const homepageSectionSchema = new Schema<IHomepageSection>(
  {
    type: { type: String, required: true, enum: HOMEPAGE_SECTION_TYPES },
    title: { type: String, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 1000 },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    ctaLabel: { type: String, trim: true, maxlength: 40 },
    ctaHref: { type: String, trim: true, maxlength: 200 },
    isVisible: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    categorySlug: { type: String, trim: true },
    productMode: { type: String, enum: PRODUCT_SHOWCASE_MODES },
    limit: { type: Number, min: 1, max: 12 },
    blocks: { type: [trustStripBlockSchema], default: undefined },
  },
  { timestamps: true }
);

/** One document per fixed type; unlimited `promoBanner`/`productShowcase`/`banner` documents. */
homepageSectionSchema.index(
  { type: 1 },
  { unique: true, partialFilterExpression: { type: { $nin: ["promoBanner", "productShowcase", "banner"] } } }
);

export const HomepageSectionModel: Model<IHomepageSection> = model<IHomepageSection>(
  "HomepageSection",
  homepageSectionSchema
);

export const HOMEPAGE_SECTION_DEFAULTS: Array<
  Pick<
    IHomepageSection,
    "type" | "title" | "subtitle" | "description" | "isVisible" | "sortOrder" | "blocks"
  >
> = [
  {
    type: "hero",
    title: "Authentic Saudi Products\nDelivered to Your Doorstep.",
    subtitle:
      "Experience the finest quality dates, exclusive gift boxes, and authentic heritage pieces curated for the discerning collector.",
    description: undefined,
    isVisible: true,
    sortOrder: 0,
    blocks: undefined,
  },
  {
    type: "trustStrip",
    title: undefined,
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 1,
    blocks: [
      { icon: "BadgeCheck", label: "100% Authentic", isVisible: true },
      { icon: "Globe", label: "Imported from Saudi", isVisible: true },
      { icon: "Truck", label: "Fast Delivery", isVisible: true },
      { icon: "ShieldCheck", label: "Quality Assured", isVisible: true },
    ],
  },
  {
    type: "featuredCategories",
    title: "Explore Our Collections",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 2,
    blocks: undefined,
  },
  {
    type: "bestSellers",
    title: "Best Sellers",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 3,
    blocks: undefined,
  },
  {
    type: "productStory",
    title: "The Essence of Madinah",
    subtitle: undefined,
    description:
      "Our journey begins in the sacred orchards of Madinah, where centuries-old traditions meet meticulous cultivation. We believe that true luxury lies in authenticity. Every product we bring to Bangladesh is a testament to the rich heritage of Saudi Arabia, carefully selected to ensure you experience the unparalleled quality and spiritual significance woven into each date.",
    isVisible: true,
    sortOrder: 7,
    blocks: undefined,
  },
  {
    type: "customerReviews",
    title: "Words from Our Patrons",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 8,
    blocks: undefined,
  },
];
