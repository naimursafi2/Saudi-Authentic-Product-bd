import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Fixed 3 types — one singleton document each, lazily seeded by
 * `staticPage.service.ts#ensureDefaultPages` — same pattern as
 * `HomepageSection`'s fixed types (editable, not creatable/deletable).
 * Powers the storefront's previously-hardcoded `/about`, `/contact`, and
 * `/shipping-policy` body copy. Contact's phone/email/social links are
 * NOT duplicated here — they stay on the existing `SiteSettings` singleton;
 * this model only adds the page's own intro text and address line.
 */
export const STATIC_PAGE_TYPES = ["about", "contact", "shippingPolicy"] as const;
export type StaticPageType = (typeof STATIC_PAGE_TYPES)[number];

/** Allow-listed lucide icon names for About's value-highlight blocks. */
export const STATIC_PAGE_BLOCK_ICONS = [
  "BadgeCheck",
  "ShieldCheck",
  "Globe",
  "HandCoins",
  "Truck",
  "Clock",
  "Package",
  "Award",
  "Star",
  "Leaf",
] as const;
export type StaticPageBlockIcon = (typeof STATIC_PAGE_BLOCK_ICONS)[number];

export interface IStaticPageBlock {
  title: string;
  body: string;
  icon?: StaticPageBlockIcon;
  isVisible: boolean;
}

const staticPageBlockSchema = new Schema<IStaticPageBlock>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 1000 },
    icon: { type: String, enum: STATIC_PAGE_BLOCK_ICONS },
    isVisible: { type: Boolean, default: true },
  },
  { _id: false }
);

export interface IStaticPage extends Document {
  _id: Types.ObjectId;
  type: StaticPageType;
  heroTitle?: string;
  heroDescription?: string;
  heroImage?: { url: string; publicId: string };
  introText?: string;
  addressLine?: string;
  /** About's value-highlight grid, or Shipping Policy's list of sections. Replaced wholesale on update. */
  blocks: IStaticPageBlock[];
  ctaTitle?: string;
  ctaDescription?: string;
  ctaButtonLabel?: string;
  ctaButtonHref?: string;
  createdAt: Date;
  updatedAt: Date;
}

const staticPageSchema = new Schema<IStaticPage>(
  {
    type: { type: String, required: true, enum: STATIC_PAGE_TYPES, unique: true },
    heroTitle: { type: String, trim: true, maxlength: 160 },
    heroDescription: { type: String, trim: true, maxlength: 2000 },
    heroImage: {
      url: { type: String },
      publicId: { type: String },
    },
    introText: { type: String, trim: true, maxlength: 1000 },
    addressLine: { type: String, trim: true, maxlength: 200 },
    blocks: { type: [staticPageBlockSchema], default: [] },
    ctaTitle: { type: String, trim: true, maxlength: 160 },
    ctaDescription: { type: String, trim: true, maxlength: 400 },
    ctaButtonLabel: { type: String, trim: true, maxlength: 40 },
    ctaButtonHref: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

export const StaticPageModel: Model<IStaticPage> = model<IStaticPage>("StaticPage", staticPageSchema);

export const STATIC_PAGE_DEFAULTS: Array<
  Pick<
    IStaticPage,
    | "type"
    | "heroTitle"
    | "heroDescription"
    | "introText"
    | "addressLine"
    | "blocks"
    | "ctaTitle"
    | "ctaDescription"
    | "ctaButtonLabel"
    | "ctaButtonHref"
  >
> = [
  {
    type: "about",
    heroTitle: "Our Story",
    heroDescription:
      "Saudi Authentic Product was founded with a simple belief: the people of Bangladesh deserve access to genuine, unadulterated Saudi heritage — from the sacred date orchards of Madinah to the artisans of the Kingdom.\n\nWhat began as a small effort to bring premium Ajwa dates home for family and friends has grown into a curated marketplace, built on the same principle every single day: authenticity first, always.",
    introText: undefined,
    addressLine: undefined,
    blocks: [
      {
        title: "Guaranteed Authenticity",
        body: "Every product is sourced directly from certified farms and artisans in Saudi Arabia — no intermediaries, no substitutes.",
        icon: "BadgeCheck",
        isVisible: true,
      },
      {
        title: "Rigorous Quality Control",
        body: "Each batch is inspected before it leaves the Kingdom and again before it reaches your doorstep in Bangladesh.",
        icon: "ShieldCheck",
        isVisible: true,
      },
      {
        title: "A Bridge Across Borders",
        body: "We built Saudi Authentic Product to make genuine Saudi heritage accessible to every home in Bangladesh.",
        icon: "Globe",
        isVisible: true,
      },
      {
        title: "Fair, Transparent Pricing",
        body: "Premium doesn't have to mean unreasonable. We keep our pricing honest and our packaging worthy of the product inside.",
        icon: "HandCoins",
        isVisible: true,
      },
    ],
    ctaTitle: "Experience Saudi Heritage, Delivered Home.",
    ctaDescription:
      "Explore our collection of premium dates and gift boxes, curated for the discerning collector.",
    ctaButtonLabel: "Shop Now",
    ctaButtonHref: "/shop",
  },
  {
    type: "contact",
    heroTitle: "Contact Us",
    heroDescription: undefined,
    introText: "Have a question about an order, a product, or a partnership? We'd love to hear from you.",
    addressLine: "Gulshan, Dhaka, Bangladesh",
    blocks: [],
    ctaTitle: undefined,
    ctaDescription: undefined,
    ctaButtonLabel: undefined,
    ctaButtonHref: undefined,
  },
  {
    type: "shippingPolicy",
    heroTitle: "Shipping Policy",
    heroDescription: undefined,
    introText: undefined,
    addressLine: undefined,
    blocks: [
      {
        title: "Delivery Coverage",
        body: "We currently deliver across all major cities and districts in Bangladesh, including Dhaka, Chattogram, Sylhet and beyond.",
        isVisible: true,
      },
      {
        title: "Delivery Timelines",
        body: "Standard delivery takes 3–5 business days inside Bangladesh. Express delivery (1–2 business days) is available for Dhaka addresses only.",
        isVisible: true,
      },
      {
        title: "Shipping Fees",
        body: "Standard shipping is ৳60 and Express shipping is ৳120. Orders over ৳5,000 qualify for free standard delivery.",
        isVisible: true,
      },
      {
        title: "Order Tracking",
        body: "Once your order is dispatched, you will receive a confirmation with tracking details via email, and you can track its status anytime using your order number and email on our Track Order page.",
        isVisible: true,
      },
    ],
    ctaTitle: undefined,
    ctaDescription: undefined,
    ctaButtonLabel: undefined,
    ctaButtonHref: undefined,
  },
];
