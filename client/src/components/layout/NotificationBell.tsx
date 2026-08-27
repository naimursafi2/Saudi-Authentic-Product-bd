"use client";

import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { listMyNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/api/notifications";
import type { ApiNotification } from "@/types/api";

const POLL_MS = 60_000;

/**
 * The customer-facing "Website Notification" delivery channel a campaign can
 * target (see CLAUDE.md's Customer Messaging section) — a bell icon with an
 * unread badge, mirroring the Wishlist/Cart action icons beside it in the
 * header, opening a click-toggled dropdown (not hover, since it needs a
 * network fetch) listing the customer's own campaign notifications.
 */
export function NotificationBell({ actionClassName, labelClassName, badgeClassName }: {
  actionClassName: string;
  labelClassName: string;
  badgeClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  function refreshUnreadCount() {
    listMyNotifications({ limit: 1 })
      .then(({ data }) => setUnreadCount(data.unreadCount))
      .catch(() => {});
  }

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      setIsLoading(true);
      listMyNotifications({ limit: 10 })
        .then(({ data }) => {
          setNotifications(data.notifications);
          setUnreadCount(data.unreadCount);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }

  async function handleMarkRead(notification: ApiNotification) {
    if (notification.isRead) return;
    setNotifications((prev) => prev.map((n) => (n._id === notification._id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationRead(notification._id);
    } catch {
      // Best-effort UI optimism — a background refresh will reconcile it.
    }
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      // Same best-effort reasoning as above.
    }
  }

  return (
    <div className="group relative flex items-stretch">
      <button type="button" onClick={toggleOpen} className={actionClassName} aria-label="Notifications">
        <span className="relative">
          <Bell size={19} />
          {unreadCount > 0 && <span className={badgeClassName}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </span>
        <span className={cn(labelClassName, "hidden sm:block")}>Alerts</span>
      </button>

      {open && (
        <>
          <button aria-label="Close notifications" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 w-80 pt-2">
            <div className="max-h-96 overflow-y-auto rounded-xl border border-gold-500/25 bg-cream-50 shadow-[0_12px_30px_rgba(1,45,29,0.15)]">
              <div className="flex items-center justify-between border-b border-green-900/10 px-4 py-2.5">
                <span className="text-xs font-bold uppercase tracking-[0.06em] text-green-950">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-gold-700 hover:text-gold-600"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>
              {isLoading ? (
                <p className="px-4 py-6 text-center text-xs text-brown-500">Loading…</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-brown-500">No notifications yet.</p>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => handleMarkRead(notification)}
                    className={cn(
                      "flex w-full cursor-pointer flex-col gap-0.5 border-b border-green-900/5 px-4 py-2.5 text-left last:border-none hover:bg-green-950/5",
                      !notification.isRead && "bg-gold-soft/40"
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-950">
                      {!notification.isRead && <span className="size-1.5 shrink-0 rounded-full bg-gold-500" />}
                      {notification.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-brown-600">{notification.message}</span>
                    <span className="text-[10px] text-brown-500">
                      {new Date(notification.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
