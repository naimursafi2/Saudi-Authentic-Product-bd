"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { listMyPerformanceReviews } from "@/lib/api/performance";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { StarRating } from "@/components/ui/StarRating";
import type { ApiPerformanceReview } from "@/types/hr";

export default function EmployeePerformancePage() {
  const [reviews, setReviews] = useState<ApiPerformanceReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    listMyPerformanceReviews(1, 30)
      .then(({ data }) => {
        setReviews(data.reviews);
        setError(null);
      })
      .catch(() => setError("Could not load your performance reviews."))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Performance" description="Reviews from your managers." />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No performance reviews yet" />
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => {
            const reviewer = typeof review.reviewer === "string" ? "Manager" : review.reviewer.name;
            return (
              <div
                key={review._id}
                className="flex flex-col gap-4 rounded-xl border border-brown-600/10 bg-white p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)] transition-shadow duration-150 hover:shadow-md sm:flex-row sm:items-start sm:gap-5"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-green-950/5 text-sm font-bold text-green-900">
                  {reviewer.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-serif text-lg text-green-950">{review.period}</p>
                    <StarRating rating={review.rating} size={15} showValue />
                  </div>
                  {review.notes && <p className="mt-2 text-sm leading-relaxed text-brown-600">{review.notes}</p>}
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-brown-500">
                    Reviewed by {reviewer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
