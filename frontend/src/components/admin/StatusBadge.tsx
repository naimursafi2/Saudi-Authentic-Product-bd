import { cn } from "@/lib/utils";

const PALETTE: Record<string, string> = {
  // neutral / pending
  pending: "bg-cream-300 text-brown-600",
  todo: "bg-cream-300 text-brown-600",
  // in-progress / informational
  processing: "bg-[#fcf8ee] text-[#735c00]",
  in_progress: "bg-[#fcf8ee] text-[#735c00]",
  late: "bg-[#fcf8ee] text-[#735c00]",
  half_day: "bg-[#fcf8ee] text-[#735c00]",
  // positive / complete
  delivered: "bg-green-900 text-white",
  done: "bg-green-900 text-white",
  paid: "bg-green-900 text-white",
  approved: "bg-green-900 text-white",
  present: "bg-[#e9f3ee] text-green-900",
  shipped: "bg-[#e9f3ee] text-green-900",
  active: "bg-[#e9f3ee] text-green-900",
  // negative
  cancelled: "bg-[#fbeceb] text-[#8a4a3f]",
  rejected: "bg-[#fbeceb] text-[#8a4a3f]",
  absent: "bg-[#fbeceb] text-[#8a4a3f]",
  inactive: "bg-[#fbeceb] text-[#8a4a3f]",
  leave: "bg-[#fbeceb] text-[#8a4a3f]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em]",
        PALETTE[status] ?? "bg-cream-300 text-brown-600"
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
