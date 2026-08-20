import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Clock,
  KeyRound,
  Package,
  Settings2,
  Truck,
  UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApiOrder, OrderStatus } from "@/types/api";

export const ORDER_STATUS_STEPS: { status: OrderStatus; label: string; icon: typeof Clock }[] = [
  { status: "pending", label: "Order Placed", icon: Clock },
  { status: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { status: "processing", label: "Processing", icon: Settings2 },
  { status: "packed", label: "Packed", icon: Package },
  { status: "ready_for_dispatch", label: "Ready for Dispatch", icon: Boxes },
  { status: "assigned_to_agent", label: "Agent Assigned", icon: UserCheck },
  { status: "picked_up", label: "Picked Up", icon: Truck },
  { status: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { status: "otp_verified", label: "OTP Verified", icon: KeyRound },
  { status: "delivered", label: "Delivered", icon: CheckCircle2 },
];

/** Statuses that branch off the linear pipeline — rendered as a banner instead of a step. */
const BRANCH_STATUS_COPY: Partial<Record<OrderStatus, string>> = {
  cancelled: "This order was cancelled",
  delivery_failed: "A delivery attempt failed for this order",
  returned: "This order was returned",
  refunded: "This order was refunded",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A visual step-by-step order status tracker, shared between the public
 * `/track-order` page and the account portal's Order History — a single
 * timeline implementation instead of two.
 */
export function OrderStatusTimeline({
  status,
  statusHistory,
}: {
  status: OrderStatus;
  statusHistory: ApiOrder["statusHistory"];
}) {
  const branchCopy = BRANCH_STATUS_COPY[status];
  if (branchCopy) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-soft p-5 text-sm text-danger">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <p>
          {branchCopy}
          {statusHistory.length > 0 ? ` on ${formatDateTime(statusHistory[statusHistory.length - 1].at)}` : ""}
          . Contact us if you believe this is a mistake.
        </p>
      </div>
    );
  }

  const currentStepIndex = ORDER_STATUS_STEPS.findIndex((s) => s.status === status);

  return (
    <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)]">
      <div className="flex min-w-[720px] items-start justify-between">
        {ORDER_STATUS_STEPS.map((step, i) => {
          const reached = i <= currentStepIndex;
          const Icon = step.icon;
          return (
            <div key={step.status} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div
                  className={cn("h-0.5 flex-1", i === 0 ? "invisible" : reached ? "bg-brand-deep-2" : "bg-cream-300")}
                />
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    reached
                      ? "border-green-900 bg-brand-deep-2 text-white"
                      : "border-cream-300 bg-cream-50 text-brown-500/60"
                  )}
                >
                  <Icon size={16} />
                </div>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === ORDER_STATUS_STEPS.length - 1
                      ? "invisible"
                      : i < currentStepIndex
                        ? "bg-brand-deep-2"
                        : "bg-cream-300"
                  )}
                />
              </div>
              <p
                className={cn(
                  "mt-2 text-[11px] font-bold uppercase tracking-[0.06em]",
                  reached ? "text-green-950" : "text-brown-500/60"
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
