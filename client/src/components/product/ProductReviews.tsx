"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, Camera, PenLine, Star } from "lucide-react";
import { listProductReviews, createReview } from "@/lib/api/reviews";
import { ApiClientError } from "@/lib/api/client";
import { toCustomerReview } from "@/lib/mappers";
import { useAuth } from "@/context/AuthContext";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StarRating } from "@/components/ui/StarRating";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { CustomerReview } from "@/types/product";

export function ProductReviews({ productId }: { productId: string }) {
  const { user, status } = useAuth();
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listProductReviews(productId, 1, 50)
      .then(({ data }) => {
        if (!cancelled) setReviews(data.reviews.map(toCustomerReview));
      })
      .catch(() => {
        if (!cancelled) setReviews([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const { data } = await createReview(productId, rating, comment, images);
      setReviews((prev) => [toCustomerReview(data.review), ...prev]);
      setComment("");
      setRating(5);
      setImages([]);
      setSubmitted(true);
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Could not submit your review.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="flex flex-col gap-10">
        <SectionHeading title="Customer Reviews" align="left" dividerWidth={64} />

        {status === "authenticated" && user?.role === "customer" && !submitted && !formOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-2"
            onClick={() => setFormOpen(true)}
          >
            <PenLine size={15} />
            Write a Review
          </Button>
        )}

        {status === "authenticated" && user?.role === "customer" && !submitted && formOpen && (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-lg border border-brown-600/15 bg-cream-200 p-6"
          >
            <p className="text-sm font-semibold text-green-950">Write a review</p>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Rate ${i + 1} stars`}
                  onClick={() => setRating(i + 1)}
                  className="cursor-pointer p-0.5"
                >
                  <Star
                    size={22}
                    className={cn(i < rating ? "fill-gold-500 text-gold-500" : "fill-none text-brown-500/30")}
                  />
                </button>
              ))}
            </div>
            <textarea
              required
              minLength={2}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your experience with this product..."
              rows={3}
              className="rounded border border-green-900/15 bg-cream-100 p-3 text-sm text-green-950 placeholder:text-brown-500/60 focus:border-green-900/40 focus:outline-none"
            />
            <label className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-semibold text-brown-600 hover:text-green-950">
              <Camera size={15} />
              {images.length > 0 ? `${images.length} photo(s) attached` : "Add photos (optional)"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 4))}
              />
            </label>
            {formError && <p className="text-sm text-danger">{formError}</p>}
            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Review"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
        {submitted && (
          <p className="rounded-lg border border-green-900/15 bg-cream-200 p-4 text-sm text-green-950">
            Thank you — your review has been posted.
          </p>
        )}
        {status === "unauthenticated" && (
          <p className="text-sm text-brown-600">
            <Link href="/account" className="font-semibold text-green-950 underline">
              Sign in
            </Link>{" "}
            to write a review.
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-24 w-full animate-pulse rounded-lg bg-cream-300" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-brown-600">No reviews yet — be the first to share your thoughts.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="flex flex-col gap-3 rounded-lg border border-black/10 bg-cream-100 p-6"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-warning-soft text-sm font-semibold text-brown-600">
                    {review.initial}
                  </span>
                  <span className="text-sm font-semibold text-green-950">{review.author}</span>
                  {review.isVerifiedPurchase && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-900">
                      <BadgeCheck size={12} />
                      Verified Purchase
                    </span>
                  )}
                  <StarRating rating={review.rating} size={14} className="ml-auto" />
                </div>
                <p className="text-sm leading-relaxed text-brown-600">{review.quote}</p>
                <p className="text-xs text-brown-500">
                  {new Date(review.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {review.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.images.map((img) => (
                      <a key={img.publicId} href={img.url} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={img.url}
                          alt="Review photo"
                          width={64}
                          height={64}
                          className="size-16 rounded object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
