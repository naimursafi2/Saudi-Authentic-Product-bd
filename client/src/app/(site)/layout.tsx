import { connection } from "next/server";
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
 * Previously kept at no-store (no `revalidate`) because passing one here
 * makes every fetch in this shared layout statically cacheable, and with
 * nothing else in the tree forcing dynamic rendering, Next treats every
 * route under (site) as a build-time-static candidate — Vercel's build then
 * tries to prerender pages like /account against the backend AT BUILD TIME,
 * which fails outright if Render (free tier, cold-sleeps) isn't awake right
 * then. That's a real production build failure this project hit before.
 *
 * The `await connection()` call below is what actually fixes that without
 * giving up caching: it explicitly forces this whole route group to render
 * per-request (same "skip build-time prerendering" effect `force-dynamic`
 * had), but — unlike `force-dynamic` — it does NOT also force every fetch to
 * `no-store`. So builds stay safe, and the 60s `revalidate` window below
 * still works: the nav/categories/settings calls hit the backend at most
 * once every 60 seconds (shared across every visitor), instead of on every
 * single page load, which is what made Home <-> Shop navigation feel like a
 * full reload every time — see (site)/page.tsx.
 */
async function getSiteChrome() {
  await connection();
  const [categoriesResult, navLinksResult, settingsResult] =
    await Promise.allSettled([
      listCategories(false, 60),
      listNavLinks(false, 60),
      getSiteSettings(60),
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
