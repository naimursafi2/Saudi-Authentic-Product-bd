"use client";

import { useEffect, useState } from "react";
import { Trash2, Star } from "lucide-react";
import { listAllReviews, deleteReview } from "@/lib/api/reviews";
import { useConfirm } from "@/context/ConfirmDialogContext";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { StarRating } from "@/components/ui/StarRating";
import type { ApiReview, Pagination } from "@/types/api";

export default function AdminReviewsPage() {
  const confirmDialog = useConfirm();
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setIsLoading(true);
    listAllReviews(page, 20)
      .then(({ data, pagination: pg }) => {
        setReviews(data.reviews);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load reviews."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  async function handleDelete(review: ApiReview) {
    const ok = await confirmDialog({
      title: "Delete Review",
      message: "Delete this review? This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    await deleteReview(review._id);
    load();
  }

  return (
    <div>
      <PageHeader title="Reviews" description="Moderate customer reviews across every product." />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={Star} title="No reviews yet" description="Customer reviews will appear here once submitted." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Comment</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const productName =
                  typeof review.product === "string" ? review.product : review.product.name;
                const customerName =
                  typeof review.customer === "string" ? review.customer : review.customer.name;
                return (
                  <tr key={review._id} className="border-b border-brown-600/10 last:border-none">
                    <td className="px-4 py-3 font-medium text-green-950">{productName}</td>
                    <td className="px-4 py-3 text-brown-600">{customerName}</td>
                    <td className="px-4 py-3">
                      <StarRating rating={review.rating} size={14} />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-brown-600">
                      <p className="line-clamp-2">{review.comment}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-brown-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        aria-label="Delete"
                        onClick={() => handleDelete(review)}
                        className="cursor-pointer text-brown-500 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />
    </div>
  );
}
