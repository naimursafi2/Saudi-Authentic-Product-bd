import { Schema, model, type Document, type Model, type Types } from "mongoose";

/**
 * The customer-facing "Website Notification" delivery channel for campaigns
 * (see CLAUDE.md's Customer Messaging section) — one row per recipient per
 * campaign, which is the normal shape for a per-user inbox (unlike email/SMS,
 * a website notification has to be individually readable/dismissable by its
 * owner, so it can't be collapsed into an aggregate count the way
 * `Campaign.deliveries[].channelResults` does for email/SMS). This is
 * deliberately NOT a general notification system — it exists only to carry
 * campaign messages into a customer's own account, the same "specific,
 * spec-defined surface, not a general framework" pattern the staff-facing
 * `notification.service.ts` fan-outs already follow.
 */
export interface INotification extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  campaign?: Types.ObjectId;
  title: string;
  message: string;
  image?: { url: string; publicId: string };
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    campaign: { type: Schema.Types.ObjectId, ref: "Campaign" },
    title: { type: String, required: true, trim: true, maxlength: 150 },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    image: {
      url: { type: String },
      publicId: { type: String },
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Every list/unread-count query is scoped to one user, newest first.
notificationSchema.index({ user: 1, createdAt: -1 });

export const NotificationModel: Model<INotification> = model<INotification>(
  "Notification",
  notificationSchema
);
