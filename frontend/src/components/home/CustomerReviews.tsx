import { listRecentReviews } from "@/lib/api/reviews";
import { toCustomerReview } from "@/lib/mappers";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { StarRating } from "@/components/ui/StarRating";

export async function CustomerReviews() {
  const { data } = await listRecentReviews(8);
  const reviews = data.reviews.map(toCustomerReview);

  if (reviews.length === 0) return null;

  return (
    <section className="border-y border-brown-600/10 bg-cream-50 px-6 py-16 sm:px-10 lg:px-16 lg:py-20">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12">
        <SectionHeading title="Words from Our Patrons" dividerWidth={64} />
        <div className="no-scrollbar flex snap-x gap-6 overflow-x-auto pb-2">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="flex w-[320px] shrink-0 snap-start flex-col gap-4 rounded border border-black/10 bg-cream-300 p-8 shadow-[0_4px_7.5px_rgba(61,43,31,0.03)] sm:w-[380px]"
            >
              <StarRating rating={review.rating} size={16} />
              <p className="text-base italic leading-relaxed text-ink-900">
                &ldquo;{review.quote}&rdquo;
              </p>
              <div className="mt-auto flex items-center gap-3 pt-2">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#f8dac8] text-lg font-semibold text-[#755e50]">
                  {review.initial}
                </span>
                <span className="text-base font-semibold text-green-950">
                  {review.author}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
