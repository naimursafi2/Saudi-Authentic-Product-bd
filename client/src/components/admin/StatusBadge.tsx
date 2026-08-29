import { cn } from "@/lib/utils";

const PALETTE: Record<string, string> = {
  // neutral / pending
  pending: "bg-cream-300 text-brown-600",
  confirmed: "bg-cream-300 text-brown-600",
  todo: "bg-cream-300 text-brown-600",
  scheduled: "bg-cream-300 text-brown-600",
  pending_review: "bg-cream-300 text-brown-600",
  draft: "bg-cream-300 text-brown-600",
  // in-progress / informational
  processing: "bg-gold-soft text-gold-700",
  packed: "bg-gold-soft text-gold-700",
  ready_for_dispatch: "bg-gold-soft text-gold-700",
  in_progress: "bg-gold-soft text-gold-700",
  late: "bg-gold-soft text-gold-700",
  half_day: "bg-gold-soft text-gold-700",
  pending_approval: "bg-gold-soft text-gold-700",
  awaiting_stock_approval: "bg-gold-soft text-gold-700",
  initiated: "bg-gold-soft text-gold-700",
  unpaid: "bg-cream-300 text-brown-600",
  delete_requested: "bg-gold-soft text-gold-700",
  recycled: "bg-danger-soft text-danger",
  purged: "bg-cream-300 text-brown-600",
  sending: "bg-gold-soft text-gold-700",
  paused: "bg-cream-300 text-brown-600",
  // positive / complete
  delivered: "bg-brand-deep-2 text-white",
  done: "bg-brand-deep-2 text-white",
  paid: "bg-brand-deep-2 text-white",
  approved: "bg-brand-deep-2 text-white",
  granted: "bg-brand-deep-2 text-white",
  received: "bg-brand-deep-2 text-white",
  sent: "bg-brand-deep-2 text-white",
  present: "bg-success-soft text-green-900",
  shipped: "bg-success-soft text-green-900",
  active: "bg-success-soft text-green-900",
  verified: "bg-success-soft text-green-900",
  visible: "bg-success-soft text-green-900",
  assigned_to_agent: "bg-success-soft text-green-900",
  picked_up: "bg-success-soft text-green-900",
  out_for_delivery: "bg-success-soft text-green-900",
  otp_verified: "bg-success-soft text-green-900",
  // negative
  cancelled: "bg-danger-soft text-danger",
  rejected: "bg-danger-soft text-danger",
  denied: "bg-danger-soft text-danger",
  absent: "bg-danger-soft text-danger",
  inactive: "bg-danger-soft text-danger",
  leave: "bg-danger-soft text-danger",
  expired: "bg-danger-soft text-danger",
  disabled: "bg-danger-soft text-danger",
  hidden: "bg-danger-soft text-danger",
  delivery_failed: "bg-danger-soft text-danger",
  returned: "bg-danger-soft text-danger",
  refunded: "bg-danger-soft text-danger",
  failed: "bg-danger-soft text-danger",
  unverified: "bg-gold-soft text-gold-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        PALETTE[status] ?? "bg-cream-300 text-brown-600"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
