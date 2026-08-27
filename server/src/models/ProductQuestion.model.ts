import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * Product Questions & Answers — distinct from `Review` (a star rating +
 * comment left once after purchase). A question is visible publicly the
 * moment it's asked, answered or not, matching common storefront Q&A UX
 * (e.g. "no answer yet" vs. a staff-provided answer) — there is no
 * moderation/approval step, the same simplicity `Review` itself follows
 * (staff can only delete, never "unpublish" one).
 */
export interface IProductQuestion extends Document {
  _id: Types.ObjectId;
  product: Types.ObjectId;
  customer: Types.ObjectId;
  question: string;
  answer?: string;
  answeredBy?: Types.ObjectId;
  answeredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const productQuestionSchema = new Schema<IProductQuestion>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, required: true, trim: true, maxlength: 500 },
    answer: { type: String, trim: true, maxlength: 1000 },
    answeredBy: { type: Schema.Types.ObjectId, ref: "User" },
    answeredAt: { type: Date },
  },
  { timestamps: true }
);

export const ProductQuestionModel: Model<IProductQuestion> = model<IProductQuestion>(
  "ProductQuestion",
  productQuestionSchema
);
