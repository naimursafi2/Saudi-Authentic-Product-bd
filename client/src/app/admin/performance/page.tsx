"use client";

import { useEffect, useState } from "react";
import { Plus, TrendingUp } from "lucide-react";
import { createPerformanceReview, listPerformanceReviews } from "@/lib/api/performance";
import { listUsers } from "@/lib/api/users";
import { ApiClientError } from "@/lib/api/client";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState, TableSkeleton, ErrorState } from "@/components/admin/EmptyState";
import { Modal } from "@/components/admin/Modal";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Button } from "@/components/ui/Button";
import { StarRating } from "@/components/ui/StarRating";
import { PerformanceReviewForm, type PerformanceReviewFormValues } from "@/components/admin/PerformanceReviewForm";
import type { ApiPerformanceReview } from "@/types/hr";
import type { ApiUser, Pagination } from "@/types/api";

function personName(person: string | { name: string }): string {
  return typeof person === "string" ? person : person.name;
}

export default function AdminPerformancePage() {
  const [reviews, setReviews] = useState<ApiPerformanceReview[]>([]);
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    listPerformanceReviews({ page, limit: 20 })
      .then(({ data, pagination: pg }) => {
        setReviews(data.reviews);
        setPagination(pg ?? null);
        setError(null);
      })
      .catch(() => setError("Could not load performance reviews."))
      .finally(() => setIsLoading(false));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(load, [page]);

  useEffect(() => {
    listUsers({ role: "employee", limit: 100 })
      .then(({ data }) => setEmployees(data.users))
      .catch(() => {});
  }, []);

  async function handleSubmit(values: PerformanceReviewFormValues) {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await createPerformanceReview({
        employee: values.employee,
        period: values.period,
        rating: values.rating,
        notes: values.notes || undefined,
      });
      setIsCreating(false);
      load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not save review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Performance"
        description="Record periodic performance reviews for your team."
        action={
          <Button variant="primary" size="sm" onClick={() => setIsCreating(true)}>
            <Plus size={14} /> New Review
          </Button>
        }
      />

      {isLoading ? (
        <TableSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : reviews.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No reviews yet" description="Submit your first performance review to get started." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brown-600/10 bg-surface">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-600/10 text-xs uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Reviewer</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review._id} className="border-b border-brown-600/10 last:border-none">
                  <td className="px-4 py-3 font-medium text-green-950">{personName(review.employee)}</td>
                  <td className="px-4 py-3 text-brown-600">{review.period}</td>
                  <td className="px-4 py-3">
                    <StarRating rating={review.rating} size={14} />
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-brown-600">{review.notes || "—"}</td>
                  <td className="px-4 py-3 text-brown-600">{personName(review.reviewer)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AdminPagination pagination={pagination} onPageChange={setPage} />

      {isCreating && (
        <Modal title="New Review" onClose={() => setIsCreating(false)}>
          <PerformanceReviewForm
            employees={employees}
            error={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => setIsCreating(false)}
          />
        </Modal>
      )}
    </div>
  );
}
