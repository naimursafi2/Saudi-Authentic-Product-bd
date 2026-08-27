import { api } from "./client";
import type { ApiNotification } from "@/types/api";

export async function listMyNotifications(params: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.unreadOnly) search.set("unreadOnly", "true");
  const qs = search.toString();
  return api.get<{ notifications: ApiNotification[]; unreadCount: number }>(`/notifications/mine${qs ? `?${qs}` : ""}`);
}

export async function markNotificationRead(id: string) {
  return api.patch<{ notification: ApiNotification }>(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsRead() {
  return api.patch<null>("/notifications/mark-all-read", {});
}
