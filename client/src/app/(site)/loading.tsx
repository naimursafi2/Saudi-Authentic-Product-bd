import { PRODUCT_GRID_CLASS } from "@/lib/utils";
/**
 * Generic Suspense fallback for every (site) route that doesn't define a
 * more specific loading.tsx of its own (see shop/ and product/[slug]/ for
 * layout-matched skeletons). Without this, navigating between pages had no
 * instant feedback — the browser just sat blank until the destination
 * page's server data finished resolving.
 */
export default function SiteLoading() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-12 sm:px-10 lg:py-16">
      <div className="h-8 w-48 animate-pulse rounded bg-cream-300" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-cream-300" />
      <div className={PRODUCT_GRID_CLASS}>
        <div className="h-40 animate-pulse rounded-xl bg-cream-300" />
        <div className="h-40 animate-pulse rounded-xl bg-cream-300" />
        <div className="h-40 animate-pulse rounded-xl bg-cream-300" />
      </div>
    </div>
  );
}
