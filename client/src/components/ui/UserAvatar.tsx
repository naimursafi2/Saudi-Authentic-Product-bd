import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's avatar: their uploaded picture when there is one,
 * otherwise a circular monogram of the first letter of their name. Used
 * everywhere a logged-in identity is shown (storefront header, admin,
 * employee and delivery portal shells) so every role gets the same
 * treatment instead of a name string in some places and a picture in
 * others.
 */
export function UserAvatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  // `Array.from` (not `name[0]`) so a name starting with an emoji or a
  // multi-byte script yields a whole character rather than half a surrogate
  // pair. Falls back to "?" for an empty/whitespace-only name.
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? "?";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-deep text-on-brand ring-1 ring-gold-500/30",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span
          className="font-sans font-bold leading-none"
          style={{ fontSize: Math.max(11, Math.round(size * 0.42)) }}
        >
          {initial}
        </span>
      )}
    </span>
  );
}
