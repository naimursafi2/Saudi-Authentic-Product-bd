import type { Role } from "./roles";

/**
 * The full order/delivery pipeline. `pending`/`processing`/`delivered`/
 * `cancelled` are kept from the original 5-value enum to minimize churn;
 * `shipped` is dropped (no equivalent step — replaced by the more granular
 * `picked_up`/`out_for_delivery`); everything else is new.
 */
export const ORDER_STATUSES = [
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
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Which statuses a given status may transition into. Terminal statuses map to []. */
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

/** Statuses that may only be reached through their own dedicated delivery-agent
 * endpoint (assign-agent / delivery-status / verify-otp / delivery-failed),
 * never through the generic `PATCH /orders/:id/status`. */
export const DELIVERY_ONLY_STATUSES: OrderStatus[] = [
  "assigned_to_agent",
  "picked_up",
  "out_for_delivery",
  "otp_verified",
  "delivered",
  "delivery_failed",
];

/** Non-admin roles allowed to drive the generic status endpoint FROM a given
 * status (`admin`/`super_admin` always bypass this, but never the adjacency
 * table above). `returned -> refunded` is admin/super_admin only — refunds
 * are financial and excluded from Order Manager's roadmap responsibilities. */
export const GENERIC_STATUS_ACTOR_ROLES: Partial<Record<OrderStatus, Role[]>> = {
  pending: ["order_manager", "co_admin"],
  confirmed: ["order_manager", "co_admin"],
  processing: ["order_manager", "co_admin"],
  packed: ["order_manager", "co_admin"],
  ready_for_dispatch: ["order_manager", "co_admin"],
  assigned_to_agent: ["order_manager", "co_admin"],
  delivered: ["order_manager", "co_admin"],
  delivery_failed: ["order_manager", "co_admin"],
};
