import { Schema, model, type Document, type Model, type Types } from "mongoose";

export interface IHeroSlide extends Document {
  _id: Types.ObjectId;
  title: string;
  subtitle?: string;
  image?: { url: string; publicId: string };
  ctaLabel?: string;
  ctaHref?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const heroSlideSchema = new Schema<IHeroSlide>(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    subtitle: { type: String, trim: true, maxlength: 300 },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    ctaLabel: { type: String, trim: true, maxlength: 40 },
    ctaHref: { type: String, trim: true, maxlength: 200 },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const HeroSlideModel: Model<IHeroSlide> = model<IHeroSlide>("HeroSlide", heroSlideSchema);
