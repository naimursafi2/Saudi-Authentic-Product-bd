import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * The five fixed types map 1:1 to the storefront's existing homepage
 * components — one document each, lazily seeded by
 * `homepageSection.service.ts#ensureDefaultSections`, editable (title/
 * subtitle/description/visibility/order) but not deletable. `promoBanner`
 * and `productShowcase` are the two freely creatable/deletable types:
 * `promoBanner` for ad-hoc promotional content, `productShowcase` for a
 * configurable product grid (by category, best sellers, new arrivals, or
 * on-sale) — this is how Admin adds things like "Premium Dates", "More Date
 * Varieties", or (once real stock exists) a Watches/Chocolates showcase
 * without any code change.
 */
export const HOMEPAGE_SECTION_TYPES = [
  "hero",
  "featuredCategories",
  "bestSellers",
  "productStory",
  "customerReviews",
  "promoBanner",
  "productShowcase",
] as const;
export type HomepageSectionType = (typeof HOMEPAGE_SECTION_TYPES)[number];

export const PRODUCT_SHOWCASE_MODES = ["category", "bestSellers", "newArrivals", "onSale"] as const;
export type ProductShowcaseMode = (typeof PRODUCT_SHOWCASE_MODES)[number];

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
  },
  { timestamps: true }
);

/** One document per fixed type; unlimited `promoBanner`/`productShowcase` documents. */
homepageSectionSchema.index(
  { type: 1 },
  { unique: true, partialFilterExpression: { type: { $nin: ["promoBanner", "productShowcase"] } } }
);

export const HomepageSectionModel: Model<IHomepageSection> = model<IHomepageSection>(
  "HomepageSection",
  homepageSectionSchema
);

export const HOMEPAGE_SECTION_DEFAULTS: Array<
  Pick<IHomepageSection, "type" | "title" | "subtitle" | "description" | "isVisible" | "sortOrder">
> = [
  {
    type: "hero",
    title: "Authentic Saudi Products\nDelivered to Your Doorstep.",
    subtitle:
      "Experience the finest quality dates, exclusive gift boxes, and authentic heritage pieces curated for the discerning collector.",
    description: undefined,
    isVisible: true,
    sortOrder: 0,
  },
  {
    type: "featuredCategories",
    title: "Explore Our Collections",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 1,
  },
  {
    type: "bestSellers",
    title: "Best Sellers",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 2,
  },
  {
    type: "productStory",
    title: "The Essence of Madinah",
    subtitle: undefined,
    description:
      "Our journey begins in the sacred orchards of Madinah, where centuries-old traditions meet meticulous cultivation. We believe that true luxury lies in authenticity. Every product we bring to Bangladesh is a testament to the rich heritage of Saudi Arabia, carefully selected to ensure you experience the unparalleled quality and spiritual significance woven into each date.",
    isVisible: true,
    sortOrder: 7,
  },
  {
    type: "customerReviews",
    title: "Words from Our Patrons",
    subtitle: undefined,
    description: undefined,
    isVisible: true,
    sortOrder: 8,
  },
];
