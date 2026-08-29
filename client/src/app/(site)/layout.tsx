import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { listCategories } from "@/lib/api/categories";
import { listNavLinks } from "@/lib/api/navLinks";
import { getSiteSettings } from "@/lib/api/siteSettings";
import { toCategory } from "@/lib/mappers";

/**
 * Fetches everything the header/announcement strip need ONCE, in parallel,
 * on the server — replacing what used to be several separate uncoordinated
 * fetches (client-side hooks inside Header, plus a duplicate
 * site-settings call) that all fired only after the page hydrated, one
 * after another, against a Render free-tier backend that can take 50s+ to
 * wake up. Any one of these failing just falls back to empty/default
 * chrome, matching the previous silent-failure behavior.
 *
 * Deliberately NOT using the `revalidate` caching option here (even though
 * these are read-heavy, rarely-changing endpoints): doing so was tried and
 * reverted — it makes every fetch in this shared layout statically
 * cacheable, which flips every route under (site) from per-request dynamic
 * rendering to build-time static generation. That broke the production
 * build (Next tries to prerender pages like /account against the backend
 * at BUILD time, which fails if the backend isn't reachable then — a real
 * risk on Render's free tier, which cold-sleeps). Kept at no-store so
 * rendering mode is unchanged; the win here is purely "one parallel
 * server-side fetch instead of a client-side waterfall," not caching.
 */
async function getSiteChrome() {
  const [categoriesResult, navLinksResult, settingsResult] =
    await Promise.allSettled([
      listCategories(),
      listNavLinks(),
      getSiteSettings(),
    ]);

  return {
    categories:
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.data.categories
            .map(toCategory)
            .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    navLinks:
      navLinksResult.status === "fulfilled"
        ? [...navLinksResult.value.data.navLinks].sort(
            (a, b) => a.sortOrder - b.sortOrder,
          )
        : [],
    settings:
      settingsResult.status === "fulfilled"
        ? settingsResult.value.data.settings
        : null,
  };
}

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { categories, navLinks, settings } = await getSiteChrome();

  return (
    <>
      <AnnouncementBar
        enabled={settings?.announcementEnabled}
        text={settings?.announcementText}
      />
      <Header
        initialCategories={categories}
        initialNavLinks={navLinks}
        initialSettings={settings}
      />
      <main className="mobile-bottom-offset flex-1">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
