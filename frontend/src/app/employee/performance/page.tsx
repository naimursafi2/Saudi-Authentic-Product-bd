"use client";

import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { listMyPerformanceReviews } from "@/lib/api/performance";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
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
              <div key={review._id} className="rounded-lg border border-brown-600/10 bg-white p-6">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-green-950">{review.period}</p>
                  <span className="text-gold-500">
                    {"★".repeat(review.rating)}
                    <span className="text-brown-500/30">{"★".repeat(5 - review.rating)}</span>
                  </span>
                </div>
                {review.notes && <p className="text-sm text-brown-600">{review.notes}</p>}
                <p className="mt-2 text-xs text-brown-500">Reviewed by {reviewer}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
