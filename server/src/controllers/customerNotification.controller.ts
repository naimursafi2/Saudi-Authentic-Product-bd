import type { Request, Response } from "express";
import { catchAsync } from "../utils/catchAsync";
import { sendSuccess } from "../utils/ApiResponse";
import { paramStr } from "../utils/params";
import * as notificationService from "../services/customerNotification.service";
import type { ListNotificationsQuery } from "../validators/notification.validator";

export const listMyNotifications = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, unreadOnly } = req.query as unknown as ListNotificationsQuery;
  const { notifications, unreadCount, pagination } = await notificationService.listMyNotifications(req.user!.id, {
    page,
    limit,
    unreadOnly,
  });
  sendSuccess(res, 200, "Notifications fetched", { notifications, unreadCount }, { pagination });
});

export const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
  const notification = await notificationService.markNotificationRead(paramStr(req.params.id), req.user!.id);
  sendSuccess(res, 200, "Notification marked as read", { notification });
});

export const markAllNotificationsRead = catchAsync(async (req: Request, res: Response) => {
  await notificationService.markAllNotificationsRead(req.user!.id);
  sendSuccess(res, 200, "All notifications marked as read");
});
