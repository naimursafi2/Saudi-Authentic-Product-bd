import { Schema, model, type Document, type Model, type Types } from "mongoose";

export interface IProductVariant {
  _id?: Types.ObjectId;
  label: string; // e.g. "500g", "1kg", "2kg"
  priceBDT: number;
  compareAtPriceBDT?: number;
  stock: number;
  lowStockThreshold: number;
  sku?: string;
}

export interface IProductImage {
  url: string;
  publicId: string;
  isPrimary?: boolean;
}

export type ProductBadge = "Authentic" | "Best Seller" | "New" | "Limited";

export interface IProduct extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  origin: string;
  categories: Types.ObjectId[];
  images: IProductImage[];
  badge?: ProductBadge;
  variants: IProductVariant[];
  highlights: string[];
  storageInstructions?: string;
  ratingAverage: number;
  ratingCount: number;
  isBestSeller: boolean;
  isFeatured: boolean;
  isActive: boolean;
  /** Cheapest variant price, kept in sync on save — used for filtering/sorting. */
  minPriceBDT: number;
  createdAt: Date;
  updatedAt: Date;
}

const variantSchema = new Schema<IProductVariant>(
  {
    label: { type: String, required: true, trim: true },
    priceBDT: { type: Number, required: true, min: 0 },
    compareAtPriceBDT: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
    sku: { type: String, trim: true },
  },
  { _id: true }
);

const imageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    tagline: { type: String, required: true, trim: true, maxlength: 240 },
    description: { type: String, required: true },
    origin: { type: String, required: true, trim: true },
    categories: [{ type: Schema.Types.ObjectId, ref: "Category", required: true }],
    images: { type: [imageSchema], default: [] },
    badge: { type: String, enum: ["Authentic", "Best Seller", "New", "Limited"] },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v: IProductVariant[]) => Array.isArray(v) && v.length > 0,
        message: "A product must have at least one variant",
      },
    },
    highlights: { type: [String], default: [] },
    storageInstructions: { type: String, trim: true },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    isBestSeller: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    minPriceBDT: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

productSchema.index({ name: "text", tagline: "text", description: "text" });
productSchema.index({ categories: 1 });

// Mongoose 9's "save" pre-hooks are promise-based (no `next` callback) —
// just return/await, don't call next().
productSchema.pre("save", function preSave() {
  if (this.isModified("variants")) {
    this.minPriceBDT = this.variants.reduce(
      (min, v) => (v.priceBDT < min ? v.priceBDT : min),
      this.variants[0]?.priceBDT ?? 0
    );
  }
});

export const ProductModel: Model<IProduct> = model<IProduct>("Product", productSchema);
