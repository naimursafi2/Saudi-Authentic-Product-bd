import { Schema, model, type Document, type Model, type Types } from "mongoose";

export interface IReviewImage {
  url: string;
  publicId: string;
}

export interface IReview extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  customer: Types.ObjectId;
  rating: number;
  comment: string;
  images: IReviewImage[];
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const reviewImageSchema = new Schema<IReviewImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const reviewSchema = new Schema<IReview>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
    images: { type: [reviewImageSchema], default: [] },
    isApproved: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One review per customer per product.
reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

export const ReviewModel: Model<IReview> = model<IReview>("Review", reviewSchema);
