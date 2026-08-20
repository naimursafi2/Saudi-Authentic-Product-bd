/** Product-grid-shaped skeleton — matches ShopPageClient's layout so the
 * swap-in feels seamless instead of a generic block replacing a grid. */
export default function ShopLoading() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 px-6 py-10 sm:px-10 lg:py-14">
      <div className="flex flex-col gap-3">
        <div className="h-7 w-40 animate-pulse rounded bg-cream-300" />
        <div className="h-4 w-64 animate-pulse rounded bg-cream-300" />
      </div>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="hidden w-56 shrink-0 flex-col gap-4 lg:flex">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-cream-300" />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="aspect-square w-full animate-pulse rounded-xl bg-cream-300" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-cream-300" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-cream-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
