import { cn } from "@/lib/utils";

export function FormSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-5 rounded-lg border border-brown-600/10 bg-surface p-6 shadow-[0_1px_2px_rgba(61,43,31,0.04)] sm:p-7",
        className
      )}
    >
      <h2 className="border-b border-brown-600/10 pb-4 font-serif text-lg font-semibold text-green-950">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.06em] text-brown-600">
      {children}
    </label>
  );
}

export const inputClasses =
  "w-full rounded border border-green-900/15 bg-cream-50 px-3.5 py-2.5 text-sm text-green-950 placeholder:text-brown-500/50 focus:border-green-900/40 focus:outline-none";
