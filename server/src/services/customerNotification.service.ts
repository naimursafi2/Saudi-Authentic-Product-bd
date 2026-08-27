import { NotificationModel } from "../models/Notification.model";
import { ApiError } from "../utils/ApiError";
import type { Types } from "mongoose";

/**
 * The customer-facing "Website Notification" delivery channel — see
 * `models/Notification.model.ts`'s comment for why this is one row per
 * recipient rather than an aggregate count the way email/SMS results are
 * stored on `Campaign.deliveries[]`.
 */
export async function createCampaignNotifications(opts: {
  recipientIds: (Types.ObjectId | string)[];
  campaignId: string;
  title: string;
  message: string;
  image?: { url: string; publicId: string };
}): Promise<{ successCount: number; failureCount: number }> {
  if (opts.recipientIds.length === 0) return { successCount: 0, failureCount: 0 };

  try {
    const docs = opts.recipientIds.map((userId) => ({
      user: userId,
      campaign: opts.campaignId,
      title: opts.title,
      message: opts.message,
      image: opts.image,
    }));
    const result = await NotificationModel.insertMany(docs, { ordered: false });
    return { successCount: result.length, failureCount: opts.recipientIds.length - result.length };
  } catch (err) {
    // insertMany with ordered:false still throws once at the end summarizing
    // partial failures — treat whatever wasn't inserted as failed rather than
    // letting one bad document abort the whole batch's stats.
    console.error("[notification] bulk insert failed:", (err as Error).message);
    return { successCount: 0, failureCount: opts.recipientIds.length };
  }
}

/**
 * The same Website Notification inbox, for the handful of system-triggered
 * alerts that aren't part of a Campaign (price-drop/back-in-stock — see
 * `productAlert.service.ts`). `campaign` is simply omitted; the model has
 * always allowed that (it's optional on the schema). Still not a general
 * notification framework — just this one inbox covering campaign sends and
 * these system alerts, both surfaced through the same bell/list/mark-read UI.
 */
export async function createUserNotification(opts: {
  userId: Types.ObjectId | string;
  title: string;
  message: string;
}): Promise<void> {
  try {
    await NotificationModel.create({ user: opts.userId, title: opts.title, message: opts.message });
  } catch (err) {
    console.error("[notification] create failed:", (err as Error).message);
  }
}

export async function listMyNotifications(
  userId: string,
  filter: { page: number; limit: number; unreadOnly?: boolean }
) {
  const query: Record<string, unknown> = { user: userId };
  if (filter.unreadOnly) query.isRead = false;

  const skip = (filter.page - 1) * filter.limit;
  const [notifications, total, unreadCount] = await Promise.all([
    NotificationModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit),
    NotificationModel.countDocuments(query),
    NotificationModel.countDocuments({ user: userId, isRead: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page: filter.page,
      limit: filter.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filter.limit)),
    },
  };
}

export async function markNotificationRead(id: string, userId: string) {
  const notification = await NotificationModel.findOneAndUpdate(
    { _id: id, user: userId },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw ApiError.notFound("Notification not found");
  return notification;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await NotificationModel.updateMany({ user: userId, isRead: false }, { isRead: true });
}
