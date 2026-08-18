import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: number;
  className?: string;
  showValue?: boolean;
  reviewCount?: number;
}

export function StarRating({
  rating,
  size = 14,
  className,
  showValue = false,
  reviewCount,
}: StarRatingProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={i < Math.round(rating) ? "fill-gold-500 text-gold-500" : "fill-none text-brown-500/30"}
            strokeWidth={1.5}
          />
        ))}
      </div>
      {showValue && (
        <span className="text-xs font-medium text-brown-500">
          {rating.toFixed(1)}
          {typeof reviewCount === "number" && ` (${reviewCount} reviews)`}
        </span>
      )}
    </div>
  );
}
