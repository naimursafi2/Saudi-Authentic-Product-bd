import { Schema, model, type Document, type Model, type Types } from "mongoose";

/** Freely creatable/orderable/deletable — powers the storefront header's top-level nav links. */
export interface INavLink extends Document {
  _id: Types.ObjectId;
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  openInNewTab: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const navLinkSchema = new Schema<INavLink>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    href: { type: String, required: true, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true, index: true },
    openInNewTab: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const NavLinkModel: Model<INavLink> = model<INavLink>("NavLink", navLinkSchema);

/** Lazily inserted the first time the collection is empty — see `navLink.service.ts`. */
export const NAV_LINK_DEFAULTS: Array<Pick<INavLink, "label" | "href" | "sortOrder">> = [
  { label: "Home", href: "/", sortOrder: 0 },
  { label: "Shop", href: "/shop", sortOrder: 1 },
  { label: "Offers", href: "/offers", sortOrder: 2 },
  { label: "About", href: "/about", sortOrder: 3 },
  { label: "Contact", href: "/contact", sortOrder: 4 },
];
