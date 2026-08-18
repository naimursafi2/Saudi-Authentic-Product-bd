import type { OrderStatus } from "@/types/api";

/** Mirrors backend/src/constants/orderStatus.ts — kept in sync manually since the two apps don't share code. */
export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "ready_for_dispatch",
  "assigned_to_agent",
  "picked_up",
  "out_for_delivery",
  "otp_verified",
  "delivered",
  "delivery_failed",
  "cancelled",
  "returned",
  "refunded",
];

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "cancelled"],
  packed: ["ready_for_dispatch", "cancelled"],
  ready_for_dispatch: ["assigned_to_agent", "cancelled"],
  assigned_to_agent: ["picked_up", "cancelled"],
  picked_up: ["out_for_delivery"],
  out_for_delivery: ["otp_verified", "delivery_failed"],
  otp_verified: ["delivered"],
  delivered: ["returned"],
  delivery_failed: ["assigned_to_agent", "returned", "cancelled"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
};

/** Statuses only settable through their own dedicated delivery-agent action, never the
 * generic status dropdown. */
export const DELIVERY_ONLY_STATUSES: OrderStatus[] = [
  "assigned_to_agent",
  "picked_up",
  "out_for_delivery",
  "otp_verified",
  "delivered",
  "delivery_failed",
];

/** Statuses reachable via the generic `PATCH /orders/:id/status` from the current status. */
export function nextGenericStatuses(current: OrderStatus): OrderStatus[] {
  return (ORDER_TRANSITIONS[current] ?? []).filter((s) => !DELIVERY_ONLY_STATUSES.includes(s));
}

export function orderStatusLabel(status: OrderStatus): string {
  return status.replace(/_/g, " ");
}
