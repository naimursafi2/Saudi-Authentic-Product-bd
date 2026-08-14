import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  title: string;
  align?: "center" | "left";
  size?: "md" | "lg";
  className?: string;
  dividerWidth?: number;
}

export function SectionHeading({
  title,
  align = "center",
  size = "md",
  className,
  dividerWidth = 96,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      <h2
        className={cn(
          "font-serif font-medium text-green-950",
          size === "lg" ? "text-3xl md:text-4xl" : "text-2xl md:text-[32px]"
        )}
      >
        {title}
      </h2>
      <div
        className="h-px bg-gold-500 opacity-50"
        style={{ width: dividerWidth }}
      />
    </div>
  );
}
