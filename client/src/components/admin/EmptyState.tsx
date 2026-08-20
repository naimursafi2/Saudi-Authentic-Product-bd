import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-brown-500/30 bg-surface py-16 text-center">
      <Icon size={32} className="text-brown-500/50" />
      <p className="text-sm font-semibold text-green-950">{title}</p>
      {description && <p className="max-w-sm text-sm text-brown-500">{description}</p>}
      {action}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 w-full animate-pulse rounded bg-surface" />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-danger/30 bg-surface py-16 text-center text-sm text-danger">
      {message}
    </div>
  );
}
