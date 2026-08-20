import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination } from "@/types/api";

export function AdminPagination({
  pagination,
  onPageChange,
}: {
  pagination: Pagination | null;
  onPageChange: (page: number) => void;
}) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-brown-500">
        Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} total
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="flex size-8 cursor-pointer items-center justify-center rounded border border-green-900/15 text-green-950 hover:bg-green-950/5 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.totalPages}
          className="flex size-8 cursor-pointer items-center justify-center rounded border border-green-900/15 text-green-950 hover:bg-green-950/5 disabled:opacity-40"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
