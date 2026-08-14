import { Schema, model, type Document, type Model, type Types } from "mongoose";

export interface IPerformanceReview extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  reviewer: Types.ObjectId;
  period: string; // free-text label, e.g. "July 2026" or "Q3 2026"
  rating: number; // 1-5
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const performanceReviewSchema = new Schema<IPerformanceReview>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    period: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    notes: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

export const PerformanceReviewModel: Model<IPerformanceReview> = model<IPerformanceReview>(
  "PerformanceReview",
  performanceReviewSchema
);
