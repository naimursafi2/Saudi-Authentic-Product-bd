/** Two-column product-detail skeleton — image on one side, info stack on
 * the other, matching the real page's layout shape. */
export default function ProductLoading() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:py-14">
      <div className="aspect-square w-full animate-pulse rounded-xl bg-cream-300 lg:w-1/2" />
      <div className="flex flex-1 flex-col gap-4">
        <div className="h-4 w-24 animate-pulse rounded bg-cream-300" />
        <div className="h-9 w-3/4 animate-pulse rounded bg-cream-300" />
        <div className="h-5 w-32 animate-pulse rounded bg-cream-300" />
        <div className="mt-2 h-24 w-full animate-pulse rounded bg-cream-300" />
        <div className="mt-4 h-12 w-48 animate-pulse rounded bg-cream-300" />
      </div>
    </div>
  );
}
