import { Schema, model, type Document, type Model, type Types } from "mongoose";

export interface IFooterLink {
  label: string;
  href: string;
  sortOrder: number;
}

const footerLinkSchema = new Schema<IFooterLink>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    href: { type: String, required: true, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

/** Freely creatable/orderable/deletable — powers the storefront footer's link columns. */
export interface IFooterColumn extends Document {
  _id: Types.ObjectId;
  heading: string;
  sortOrder: number;
  isVisible: boolean;
  links: IFooterLink[];
  createdAt: Date;
  updatedAt: Date;
}

const footerColumnSchema = new Schema<IFooterColumn>(
  {
    heading: { type: String, required: true, trim: true, maxlength: 60 },
    sortOrder: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true, index: true },
    links: { type: [footerLinkSchema], default: [] },
  },
  { timestamps: true }
);

export const FooterColumnModel: Model<IFooterColumn> = model<IFooterColumn>(
  "FooterColumn",
  footerColumnSchema
);

/** Lazily inserted the first time the collection is empty — see `footerColumn.service.ts`. */
export const FOOTER_COLUMN_DEFAULTS: Array<
  Pick<IFooterColumn, "heading" | "sortOrder" | "links">
> = [
  {
    heading: "Explore",
    sortOrder: 0,
    links: [
      { label: "Our Story", href: "/about", sortOrder: 0 },
      { label: "Madinah Dates", href: "/shop?category=madinah-dates", sortOrder: 1 },
      { label: "Premium Perfumes", href: "/categories", sortOrder: 2 },
    ],
  },
  {
    heading: "Support",
    sortOrder: 1,
    links: [
      { label: "Track Order", href: "/track-order", sortOrder: 0 },
      { label: "Shipping Policy", href: "/shipping-policy", sortOrder: 1 },
      { label: "Contact Us", href: "/contact", sortOrder: 2 },
    ],
  },
];
